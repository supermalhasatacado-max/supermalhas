import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const normalize = (s) => s.trim().replace(/\s+/g, " ");
const sources = [
  "lib/shop/server.ts",
  "lib/shop/checkout.ts",
  "lib/shop/payments.ts",
  "app/api/shop/[...path]/route.ts",
];
const queries = new Set();
const condition =
  "id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded')";
for (const path of sources) {
  const file = ts.createSourceFile(
    path,
    fs.readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "prepare"
    ) {
      const value = node.arguments[0];
      if (ts.isStringLiteralLike(value)) queries.add(normalize(value.text));
      else if (ts.isTemplateExpression(value)) {
        const raw = value.getText(file);
        if (raw.includes("${all ?"))
          for (const active of ["", "WHERE active=1"])
            queries.add(
              normalize(`SELECT * FROM products ${active} ORDER BY pieces ASC`),
            );
        else if (raw.includes("${admin ?"))
          for (const owner of ["", "AND owner_key=?"])
            queries.add(normalize(`SELECT * FROM orders WHERE id=? ${owner}`));
        else if (raw.includes("${condition}"))
          queries.add(
            normalize(raw.slice(1, -1).replaceAll("${condition}", condition)),
          );
        else if (!raw.includes("${conditions}${couponCondition}"))
          throw new Error(`Unhandled SQL template in ${path}`);
      } else throw new Error(`Unhandled query in ${path}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
function postgres(sql) {
  const ignore = sql.startsWith("INSERT OR IGNORE");
  let result = sql
    .replace("INSERT OR IGNORE", "INSERT")
    .replace("MAX(0,used-1)", "GREATEST(0,used-1)")
    .replace(
      "json_extract(payment_config,'$.expiresAt')",
      "(payment_config->>'expiresAt')",
    )
    .replace("SET count=count+1", "SET count=rate_limits.count+1");
  if (ignore) result += " ON CONFLICT DO NOTHING";
  return result;
}
const entries = Array.from(queries)
  .sort()
  .map((sql) => ({
    id: "q_" + createHash("sha256").update(sql).digest("hex").slice(0, 16),
    sqlite: sql,
    postgres: postgres(sql),
    arity: (sql.match(/\?/g) || []).length,
    write: !sql.startsWith("SELECT"),
  }));
if (new Set(entries.map((s) => s.id)).size !== entries.length)
  throw new Error("Query identifier collision");
// Use a CTE to reuse the final coupon argument while retaining positional binds.
const checkoutSql =
  "INSERT INTO orders (id,number,owner_key,user_id,request_key,items,customer,address,shipping,subtotal,discount,total,coupon_code,payment_method,payment_status,fulfillment,demo,reserved,provider_environment,created_at,updated_at,payment_config) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(?::jsonb) AS check_item LEFT JOIN products p ON p.id=check_item->>'productId' WHERE p.id IS NULL OR p.active!=1 OR p.price!=(check_item->>'price')::integer OR p.pieces!=(check_item->>'pieces')::integer OR (check_item->>'qty' IS NOT NULL AND p.stock<(check_item->>'qty')::integer)) AND (SELECT coupon IS NULL OR EXISTS (SELECT 1 FROM coupons c WHERE c.code=coupon->>'code' AND c.kind=coupon->>'kind' AND c.value=(coupon->>'value')::integer AND c.minimum=(coupon->>'minimum')::integer AND c.active=1 AND c.used<c.usage_limit AND (c.expires_at IS NULL OR c.expires_at>(coupon->>'stamp')::timestamptz)) FROM (SELECT NULLIF(?::jsonb,'null'::jsonb) AS coupon) snapshot)";
const cases = [
  ...entries,
  { id: "checkout_insert", postgres: checkoutSql, arity: 23, write: true },
]
  .map(
    (s) =>
      `    WHEN '${s.id}' THEN template := $query$${s.postgres}$query$; expected := ${s.arity}; mutates := ${s.write};`,
  )
  .join("\n");
const functionSql = `
-- Closed operation catalogue. The caller sends identifiers and bound values,
-- never SQL. Only the server role can execute this function.
CREATE OR REPLACE FUNCTION public.sm_database_v1(operations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = supermalhas, pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  op jsonb; params jsonb; template text; rendered text; parts text[];
  expected integer; mutates boolean; has_writes boolean := false;
  rows jsonb; output jsonb := '[]'::jsonb; position integer;
BEGIN
  IF jsonb_typeof(operations) IS DISTINCT FROM 'array' OR jsonb_array_length(operations)>100 OR jsonb_array_length(operations)<1 THEN
    RAISE EXCEPTION 'Invalid operation batch' USING ERRCODE='22023';
  END IF;
  -- Validate the entire batch before acquiring a lock or making any change.
  FOR op IN SELECT value FROM jsonb_array_elements(operations) LOOP
    CASE op->>'id'
${cases}
    ELSE RAISE EXCEPTION 'Unknown database operation' USING ERRCODE='22023';
    END CASE;
    params := op->'params';
    IF jsonb_typeof(params) IS DISTINCT FROM 'array' OR jsonb_array_length(params)!=expected THEN
      RAISE EXCEPTION 'Invalid bound parameters' USING ERRCODE='22023';
    END IF;
    has_writes := has_writes OR mutates;
  END LOOP;
  -- PostgreSQL serializes all store mutations, including admin stock edits.
  -- One RPC is one transaction: checkout, coupon use and inventory move together.
  IF has_writes THEN PERFORM pg_advisory_xact_lock(1936747372,1); END IF;
  FOR op IN SELECT value FROM jsonb_array_elements(operations) LOOP
    CASE op->>'id'
${cases}
    ELSE RAISE EXCEPTION 'Unknown database operation';
    END CASE;
    params := op->'params'; parts := string_to_array(template,'?'); rendered := parts[1];
    FOR position IN 1..expected LOOP
      rendered := rendered || quote_nullable(params->>(position-1)) || parts[position+1];
    END LOOP;
    IF mutates THEN
      IF template NOT ILIKE '% RETURNING %' THEN rendered := rendered || ' RETURNING 1 AS changed'; END IF;
      EXECUTE 'WITH changed AS (' || rendered || ') SELECT COALESCE(jsonb_agg(to_jsonb(changed)),''[]''::jsonb) FROM changed' INTO rows;
    ELSE
      EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(result)),''[]''::jsonb) FROM (' || rendered || ') result' INTO rows;
    END IF;
    output := output || jsonb_build_array(jsonb_build_object('results',rows,'success',true,'meta',jsonb_build_object('changes',CASE WHEN mutates THEN jsonb_array_length(rows) ELSE 0 END)));
  END LOOP;
  RETURN output;
END;
$function$;
REVOKE ALL ON FUNCTION public.sm_database_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sm_database_v1(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
`;
const json = JSON.stringify(entries, null, 2) + "\n";
const migration = fs.readFileSync("supabase/schema.sql", "utf8") + functionSql;
const target = "supabase/migrations/202610100001_supermalhas.sql";
if (process.argv.includes("--check")) {
  if (
    fs.readFileSync("db/supabase-statements.json", "utf8") !== json ||
    fs.readFileSync(target, "utf8") !== migration
  )
    throw new Error(
      "Supabase contract differs from the application. Add a migration before changing a deployed contract.",
    );
} else {
  if (fs.existsSync(target))
    throw new Error(
      "Initial migration already exists. Applied migrations are immutable.",
    );
  fs.mkdirSync("supabase/migrations", { recursive: true });
  fs.writeFileSync("db/supabase-statements.json", json);
  fs.writeFileSync(target, migration);
}
console.log(
  `Supabase contract: ${entries.length} fixed operations + atomic checkout.`,
);
