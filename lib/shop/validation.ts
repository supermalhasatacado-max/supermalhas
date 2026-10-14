import { z } from "zod";
export const digits = (s: string) => s.replace(/\D/g, "");
export function validDocument(value: string, type: string) {
  const s = digits(value);
  if (/^(\d)\1+$/.test(s)) return false;
  if (type === "individual") {
    if (s.length !== 11) return false;
    for (let n = 9; n <= 10; n++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Number(s[i]) * (n + 1 - i);
      const check = (sum * 10) % 11;
      if ((check === 10 ? 0 : check) !== Number(s[n])) return false;
    }
    return true;
  }
  if (s.length !== 14) return false;
  for (let n = 12; n <= 13; n++) {
    let sum = 0,
      weight = n - 7;
    for (let i = 0; i < n; i++) {
      sum += Number(s[i]) * weight;
      if (--weight < 2) weight = 9;
    }
    const rem = sum % 11;
    if ((rem < 2 ? 0 : 11 - rem) !== Number(s[n])) return false;
  }
  return true;
}
export const gradeSchema = z
  .object({
    P: z.number().int().min(0).max(10000),
    M: z.number().int().min(0).max(10000),
    G: z.number().int().min(0).max(10000),
    GG: z.number().int().min(0).max(10000),
  })
  .strict();
export const cartSchema = z
  .array(
    z
      .object({
        productId: z.string().max(80),
        quantity: z.number().int().min(1).max(20),
        grade: gradeSchema,
      })
      .strict(),
  )
  .min(1)
  .max(20);
export const customerSchema = z
  .object({
    type: z.enum(["individual", "company"]),
    name: z.string().trim().min(3, "Informe seu nome completo.").max(64),
    document: z.string().max(25),
    email: z.string().trim().email("Informe um e-mail válido.").max(64),
    phone: z
      .string()
      .max(25)
      .refine(
        (s) => [10, 11].includes(digits(s).length),
        "Informe um telefone com DDD.",
      ),
    marketing: z.boolean().default(false),
  })
  .strict()
  .refine((x) => validDocument(x.document, x.type), {
    message: "CPF ou CNPJ inválido.",
    path: ["document"],
  });
export const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
export const addressSchema = z
  .object({
    zip: z.string().refine((s) => digits(s).length === 8, "CEP inválido."),
    street: z.string().trim().min(2).max(100),
    number: z.string().trim().min(1).max(15),
    complement: z.string().max(100).default(""),
    district: z.string().trim().min(2).max(60),
    city: z.string().trim().min(2).max(60),
    state: z.string().refine((s) => states.includes(s), "Estado inválido."),
  })
  .strict();
export const checkoutSchema = z
  .object({
    items: cartSchema,
    customer: customerSchema,
    address: addressSchema,
    shippingId: z.string().max(80),
    coupon: z.string().max(40).default(""),
    paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
    requestKey: z.string().uuid(),
    termsAccepted: z.literal(true),
    demo: z.boolean(),
  })
  .strict();
export const shippingRuleSchema = z
  .object({
    toArrange: z.boolean().optional(),
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(50),
    label: z.string().trim().min(2).max(80),
    states: z.array(z.string().refine((s) => states.includes(s))).max(27),
    amount: z.number().int().min(0).max(10000000),
    freeAbove: z.number().int().min(0).max(100000000),
    minDays: z.number().int().min(0).max(90),
    maxDays: z.number().int().min(1).max(180),
    active: z.boolean(),
  })
  .refine(
    (x) => x.maxDays >= x.minDays,
    "Prazo final deve ser maior que o inicial.",
  );
export const settingsSchema = z
  .object({
    storeName: z.string().trim().min(2).max(100),
    legalName: z.string().max(150),
    cnpj: z.string().max(25),
    fiscalEmail: z.union([z.literal(""), z.string().email()]),
    phone: z.string().max(25),
    email: z.union([z.literal(""), z.string().email()]),
    whatsapp: z.string().max(25),
    originZip: z.string().max(10),
    address: z.string().max(300),
    businessHours: z.string().max(100),
    about: z.string().max(5000),
    shippingPolicy: z.string().max(15000),
    returnPolicy: z.string().max(15000),
    privacyPolicy: z.string().max(15000),
    terms: z.string().max(15000),
    demoEnabled: z.boolean(),
    salesEnabled: z.boolean(),
    inventoryConfirmed: z.boolean(),
    maxInstallments: z.number().int().min(1).max(12),
    freeInstallments: z.number().int().min(1).max(12),
    installmentInterest: z.number().min(0).max(10),
    pixMinutes: z.number().int().min(10).max(1440),
    boletoDays: z.number().int().min(1).max(10),
    emailFrom: z.string().max(150),
    shippingRules: z.array(shippingRuleSchema).max(30),
    sizeChart: z
      .array(
        z.object({
          size: z.string().max(10),
          width: z.string().max(20),
          height: z.string().max(20),
        }),
      )
      .max(20),
  })
  .strict()
  .refine(
    (x) => x.freeInstallments <= x.maxInstallments,
    "Parcelas sem juros excedem o máximo.",
  );
export const productSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(150),
    title: z.string().trim().min(3).max(150),
    pieces: z.number().int().min(4).max(10000),
    price: z.number().int().min(100).max(100000000),
    stock: z.number().int().min(0).max(100000),
    active: z.number().int().min(0).max(1),
    featured: z.number().int().min(0).max(1),
    description: z.string().max(5000),
    image: z
      .string()
      .max(1500)
      .refine(
        (s) =>
          s.startsWith("/images/") ||
          /^\/api\/media\/[a-f0-9-]{36}$/.test(s) ||
          /^https:\/\//.test(s),
        "Use uma imagem local ou URL HTTPS.",
      ),
    specs: z.record(z.string().max(500)),
  })
  .strict();
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    kind: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1).max(10000000),
    minimum: z.number().int().min(0).max(100000000),
    usage_limit: z.number().int().min(1).max(1000000),
    active: z.number().int().min(0).max(1),
    expires_at: z.union([
      z
        .string()
        .datetime({ offset: true })
        .transform((s) => new Date(s).toISOString()),
      z.null(),
    ]),
  })
  .strict()
  .refine(
    (x) => x.kind !== "percent" || x.value <= 80,
    "Percentual máximo: 80%.",
  );
