import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  pieces: integer("pieces").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  active: integer("active").notNull().default(1),
  featured: integer("featured").notNull().default(0),
  description: text("description").notNull(),
  image: text("image").notNull(),
  specs: text("specs").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const coupons = sqliteTable("coupons", {
  code: text("code").primaryKey(),
  kind: text("kind").notNull(),
  value: integer("value").notNull(),
  minimum: integer("minimum").notNull().default(0),
  usageLimit: integer("usage_limit").notNull().default(100),
  used: integer("used").notNull().default(0),
  active: integer("active").notNull().default(1),
  expiresAt: text("expires_at"),
});
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    ownerKey: text("owner_key").notNull(),
    userId: text("user_id"),
    requestKey: text("request_key").notNull(),
    items: text("items").notNull(),
    customer: text("customer").notNull(),
    address: text("address").notNull(),
    shipping: text("shipping").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull(),
    total: integer("total").notNull(),
    couponCode: text("coupon_code"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    fulfillment: text("fulfillment").notNull().default("new"),
    paymentLink: text("payment_link"),
    providerLinkId: text("provider_link_id"),
    providerOrderId: text("provider_order_id"),
    providerEnvironment: text("provider_environment"),
    demo: integer("demo").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    paymentConfig: text("payment_config"),
    chargedTotal: integer("charged_total"),
    trackingCode: text("tracking_code"),
    carrier: text("carrier"),
    invoiceUrl: text("invoice_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("orders_owner_request").on(t.ownerKey, t.requestKey)],
);
export const events = sqliteTable("order_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});
export const newsletter = sqliteTable("newsletter", {
  email: text("email").primaryKey(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
});
