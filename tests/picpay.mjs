import assert from 'node:assert/strict';
// Do not dump bundled data URLs on an assertion failure.
process.on('uncaughtException', error => { console.error(error.message); process.exit(1); });
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
const pg = new PGlite();
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await pg.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
await pg.exec('SET ROLE service_role; SET search_path=supermalhas,pg_catalog');
globalThis.__picpayEnv = { DATABASE_PROVIDER: 'supabase', SUPABASE_URL: 'https://picpay-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture', SITE_URL: 'https://shop.example',
  PICPAY_CLIENT_ID: 'offline-client', PICPAY_CLIENT_SECRET: 'offline-secret', PICPAY_ENVIRONMENT: 'production', PICPAY_MERCHANT_CNPJ: '58312831000189', PICPAY_TRANSPARENT_TOKEN: 'offline-public-sdk-token', PICPAY_WEBHOOK_TOKEN: 'offline-webhook-token' };
const compiled = await build({ stdin: { contents: "export * from './lib/shop/server'; export * from './lib/shop/checkout'; export * from './lib/shop/payments'; export * from './lib/shop/picpay'; export * from './lib/shop/defaults'; export { POST } from './app/api/webhooks/picpay/route';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'fixture', setup(b) {
    b.onResolve({ filter: /^@\/lib\/(env|auth\/user)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path.endsWith('/env') ? 'export const env=globalThis.__picpayEnv; export const siteOrigin=()=>env.SITE_URL;' : 'export const getStoreUser=async()=>null;', loader: 'js' }));
  } }] });
const shop = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const charges = new Map(); let posts = 0, authCalls = 0, mode = 'pending', submitted, lookupId;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  if (url.origin === 'https://picpay-test.supabase.co') {
    const { operations } = JSON.parse(options.body);
    try { return Response.json((await pg.query('SELECT public.sm_database_v1($1::jsonb) AS result', [JSON.stringify(operations)])).rows[0].result); }
    catch (error) { throw new Error('RPC fixture failed: ' + error.message); }
  }
  assert(['https://checkout-api.picpay.com', 'https://checkout-api-sandbox.picpay.com'].includes(url.origin), 'Only documented PicPay hosts');
  assert.equal(options.redirect, 'error', 'Never forward private credentials through redirects');
  if (url.pathname === '/oauth2/token') {
    authCalls++; assert.deepEqual(JSON.parse(options.body), { grant_type: 'client_credentials', client_id: 'offline-client', client_secret: globalThis.__picpayEnv.PICPAY_CLIENT_SECRET });
    if (mode === 'auth-error') return Response.json({}, { status: 401 });
    return Response.json({ access_token: 'offline-access-token', expires_in: 300 });
  }
  assert.equal(new Headers(options.headers).get('authorization'), 'Bearer offline-access-token');
  if (options.method === 'POST') {
    posts++; submitted = JSON.parse(options.body);
    if (mode === 'reject') return Response.json({}, { status: 400 });
    const type = url.pathname.endsWith('/authorization') ? 'CREDIT' : url.pathname.endsWith('/wallet') ? 'WALLET' : 'PIX';
    assert.equal(submitted.paymentSource, 'GATEWAY');
    assert.equal(submitted.transactions.length, 1);
    if (type === 'CREDIT') {
      assert.equal(submitted.billingUrlAddress, 'https://shop.example');
      assert.equal(submitted.transactions[0].credit.temporaryCardToken, 'card_t/offline-fixture');
      assert(!JSON.stringify(submitted).includes('cardNumber'));
    }
    const amount = submitted.transactions[0].amount;
    const transactionStatus = mode === 'paid' ? 'PAID' : mode === 'decline' ? 'DENIED' : 'PENDING';
    const charge = { id: crypto.randomUUID(), merchantChargeId: submitted.merchantChargeId, amount, originalAmount: amount, refundedAmount: 0,
      chargeStatus: transactionStatus === 'PENDING' ? 'PRE_AUTHORIZED' : transactionStatus,
      transactions: [{ transactionId: crypto.randomUUID(), paymentType: type, amount, originalAmount: amount, refundedAmount: 0, transactionStatus,
        ...(type === 'CREDIT' ? { credit: { installmentNumber: submitted.transactions[0].credit.installmentNumber } } : { [type.toLowerCase()]: { qrCode: '000201-' + type, expiresAt: '2099-01-01T12:00:00Z' } }) }] };
    charges.set(submitted.merchantChargeId, charge);
    if (mode === 'timeout') throw new Error('Lost POST response');
    return Response.json(charge);
  }
  lookupId = url.pathname.split('/').at(-1);
  if (mode === 'outage') return Response.json({}, { status: 503 });
  return charges.has(lookupId) ? Response.json(charges.get(lookupId)) : Response.json({}, { status: 404 });
};
const query = async (sql, args = []) => (await pg.query(sql, args)).rows;
const request = new Request('https://shop.example/api/shop/checkout', { headers: { cookie: 'sm_guest=' + 'a'.repeat(64) } });
try {
  assert.equal(shop.paymentProvider(), 'picpay', 'PicPay is the default even without a provider variable');
  await shop.seed();
  const settings = { ...shop.defaultSettings, salesEnabled: true, inventoryConfirmed: true, email: 'support@example.com', shippingPolicy: 'Entrega.', returnPolicy: 'Trocas.', privacyPolicy: 'Privacidade.', terms: 'Termos.',
    shippingRules: [{ id: 'arrange', label: 'A combinar', toArrange: true, active: true, states: [], amount: 0, freeAbove: 0, minDays: 1, maxDays: 5 }] };
  await shop.db().prepare("UPDATE settings SET data=? WHERE key='store'").bind(JSON.stringify(settings)).run();
  await pg.exec('UPDATE products SET stock=30');
  const data = { items: [{ productId: 'sm-200', quantity: 1, grade: { P: 50, M: 50, G: 50, GG: 50 } }],
    customer: { type: 'individual', name: 'Cliente Teste', document: '52998224725', email: 'customer@example.com', phone: '11999999999', marketing: false },
    address: { zip: '42803113', street: 'Rua Dez de Abril', number: 's/n', complement: '', district: 'Alto da Cruz', city: 'Camaçari', state: 'BA' },
    shippingId: 'arrange', coupon: '', termsAccepted: true, demo: false };
  const place = async (method = 'pix') => (await shop.checkout(request, { ...data, paymentMethod: method, requestKey: crypto.randomUUID(), payment: { installments: method === 'credit_card' ? 3 : 1, ...(method === 'credit_card' ? { cardToken: 'card_t/offline-fixture' } : {}) } })).order;
  const sync = async id => { await shop.syncOrder(id); return shop.getOrder(id, request); };
  for (const method of ['pix', 'wallet', 'credit_card']) {
    mode = method === 'credit_card' ? 'paid' : 'pending';
    const placed = await place(method);
    assert.equal(placed.payment_config.provider, 'picpay'); assert.equal(placed.payment_config.checkout, 'transparent');
    assert.equal(placed.payment_details.method, method); assert.equal(placed.payment_status, mode);
    const count = posts; await shop.createPicpayPayment(placed); assert.equal(posts, count, 'Reopening cannot charge again');
    if (method === 'credit_card') assert.equal(placed.charged_total, placed.payment_config.installments.find(p => p.number === 3).total);
    else assert.equal(placed.payment_details.qrCode, '000201-' + method.toUpperCase());
  }
  assert.equal(authCalls, 1, 'OAuth token reused across payment requests');
  await assert.rejects(() => place('boleto'), /Pix, cartão ou carteira/);
  mode = 'timeout'; const uncertain = await place(); const beforeRecovery = posts;
  mode = 'pending'; await Promise.all([shop.createPicpayPayment(uncertain), shop.createPicpayPayment(uncertain)]);
  assert.equal(posts, beforeRecovery, 'Ambiguous responses recovered by merchantChargeId without another charge');
  const lost = charges.get(uncertain.id); charges.delete(uncertain.id);
  await pg.query('UPDATE orders SET provider_order_id=NULL WHERE id=$1', [uncertain.id]);
  await assert.rejects(() => shop.createPicpayPayment(uncertain), /sendo conferido/); assert.equal(posts, beforeRecovery);
  charges.set(uncertain.id, lost);
  mode = 'reject'; const rejected = await place(); const count = posts;
  mode = 'pending'; await Promise.allSettled([shop.createPicpayPayment(rejected), shop.createPicpayPayment(rejected)]);
  assert.equal(posts, count + 1, 'Definite rejection permits only one concurrent retry');
  const pending = await place(); const c = charges.get(pending.id);
  c.chargeStatus = 'PAID'; c.transactions[0].transactionStatus = 'PAID';
  assert.equal((await sync(pending.id)).payment_status, 'paid');
  c.chargeStatus = 'PRE_AUTHORIZED'; c.transactions[0].transactionStatus = 'PENDING';
  assert.equal((await sync(pending.id)).payment_status, 'paid', 'A late pending notification cannot reverse approval');
  c.chargeStatus = 'PAID'; c.transactions[0].transactionStatus = 'PAID';
  c.refundedAmount = c.originalAmount; c.amount = 0; Object.assign(c.transactions[0], { amount: 0, refundedAmount: c.originalAmount });
  assert.equal((await sync(pending.id)).payment_status, 'refunded', 'Pix refund amounts override stale PAID status');
  const stock = (await query("SELECT stock FROM products WHERE id='sm-200'"))[0].stock;
  await sync(pending.id); assert.equal((await query("SELECT stock FROM products WHERE id='sm-200'"))[0].stock, stock, 'Repeated refunds release stock once');
  const partial = await place(); const pc = charges.get(partial.id);
  pc.refundedAmount = 100; pc.amount -= 100; Object.assign(pc.transactions[0], { refundedAmount: 100, amount: pc.amount });
  assert.equal((await sync(partial.id)).payment_status, 'review', 'Partial refunds require review, not full restock');
  const mismatch = await place(); charges.get(mismatch.id).originalAmount++;
  assert.equal((await sync(mismatch.id)).payment_status, 'review', 'Provider amount mismatch cannot approve');
  const wrongType = await place(); charges.get(wrongType.id).transactions[0].paymentType = 'CREDIT';
  assert.equal((await sync(wrongType.id)).payment_status, 'review', 'Wrong payment method cannot approve');
  const deniedStock = (await query("SELECT stock FROM products WHERE id='sm-200'"))[0].stock;
  mode = 'decline'; assert.equal((await place('credit_card')).payment_status, 'failed');
  assert.equal((await query("SELECT stock FROM products WHERE id='sm-200'"))[0].stock, deniedStock);
  mode = 'pending'; const expiring = await place(); const exp = charges.get(expiring.id);
  exp.transactions[0].transactionStatus = 'EXPIRED';
  assert.equal((await sync(expiring.id)).payment_status, 'canceled');
  const stillPending = await place(); await assert.rejects(() => shop.cancelUnpaidOrder(stillPending.id, 'https://shop.example'), /atendimento/);
  assert.equal((await query('SELECT reserved FROM orders WHERE id=$1', [stillPending.id]))[0].reserved, 1);
  const hook = { id: 'notification-id', type: 'PAYMENT', data: { merchantChargeId: stillPending.id, status: 'PAID', amount: 1 } };
  const send = (body, headers = {}) => shop.POST(new Request('https://shop.example/api/webhooks/picpay', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  assert.equal((await send(hook)).status, 401);
  const headers = { authorization: 'offline-webhook-token' };
  assert.equal((await send(hook, headers)).status, 200); assert.equal(lookupId, stillPending.id);
  assert.equal((await shop.getOrder(stillPending.id, request)).payment_status, 'pending', 'Forged notification status and amount cannot approve');
  for (const body of ['{', null, {}, { ...hook, data: { merchantChargeId: '../charge' } }]) assert.equal((await send(body, headers)).status, 400);
  assert.equal((await send('x'.repeat(256001), headers)).status, 413);
  mode = 'outage'; assert.equal((await send(hook, headers)).status, 502); mode = 'pending';
  const original = charges.get(stillPending.id).merchantChargeId; charges.get(stillPending.id).merchantChargeId = crypto.randomUUID();
  await assert.rejects(() => sync(stillPending.id), /referência/); charges.get(stillPending.id).merchantChargeId = original;
  await pg.query("UPDATE orders SET payment_config=payment_config || '{\"provider\":\"pagarme\"}'::jsonb WHERE id=$1", [stillPending.id]);
  await assert.rejects(() => shop.verifyPicpayOrder(stillPending.id), /outro provedor/);
  mode = 'auth-error'; globalThis.__picpayEnv.PICPAY_CLIENT_SECRET = 'offline-secret-rotated';
  const postsBeforeAuthFailure = posts;
  const authFailed = await place();
  assert.equal(posts, postsBeforeAuthFailure, 'Failed OAuth must not submit a charge');
  assert(!authFailed.events?.some(e => e.id.startsWith('picpay-create:')), 'Authentication failure cannot consume the durable POST claim');
  mode = 'pending'; await shop.createPicpayPayment(authFailed);
  assert.equal(posts, postsBeforeAuthFailure + 1, 'An order recovers after fixing credentials');
  const originalStock = (await query("SELECT stock FROM products WHERE id='sm-200'"))[0].stock;
  await shop.db().prepare("UPDATE settings SET data=? WHERE key='store'").bind(JSON.stringify({ ...settings, salesEnabled: false, demoEnabled: true })).run();
  globalThis.__picpayEnv.PICPAY_ENVIRONMENT = 'test';
  const sandbox = await place(); assert.equal(sandbox.sandbox, true); assert.equal(sandbox.payment_status, 'pending');
  assert.equal((await query("SELECT stock FROM products WHERE id='sm-200'"))[0].stock, originalStock, 'Sandbox orders cannot consume production inventory');
  await assert.rejects(() => shop.verifyPicpayOrder(authFailed.id), /ambiente PicPay original/);
  delete globalThis.__picpayEnv.PICPAY_WEBHOOK_TOKEN;
  assert.equal((await send(hook, headers)).status, 503, 'Unconfigured webhook fails closed');
  const persisted = JSON.stringify((await query('SELECT * FROM orders'))) + JSON.stringify(await query('SELECT * FROM order_events'));
  for (const secret of ['card_t/offline-fixture', 'offline-secret', 'offline-access-token', 'offline-webhook-token']) assert(!persisted.includes(secret), 'Credentials/tokens must never reach database or events');
  const policiesBefore = { ...settings, privacyPolicy: 'Pagamentos Pagar.me. Frete separado.', terms: 'Pix, boleto e cartão são processados pelo Pagar.me. Para Pix e boleto, respeite os vencimentos exibidos.' };
  await shop.db().prepare("UPDATE settings SET data=? WHERE key='store'").bind(JSON.stringify(policiesBefore)).run();
  await pg.exec('RESET ROLE');
  await pg.exec(readFileSync('supabase/migrations/202610300001_picpay_wallet.sql', 'utf8'));
  const migrated = (await query("SELECT data FROM supermalhas.settings WHERE key='store'"))[0].data;
  assert.equal(migrated.privacyPolicy, 'Pagamentos PicPay. Frete separado.');
  assert(migrated.terms.includes('Pix, carteira PicPay e cartão são processados pelo PicPay.'));
  for (const key of Object.keys(settings).filter(key => !['privacyPolicy', 'terms'].includes(key))) assert.deepEqual(migrated[key], settings[key]);
  console.log('PASS: PicPay OAuth cache, Pix/wallet/card, server totals, immutable provider, status/refund verification, inventory, timeout recovery, concurrent deduplication, webhook authentication, forged events and token privacy.');
} finally { await pg.close(); }
