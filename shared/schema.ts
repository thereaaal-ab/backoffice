import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Product categories (dynamic; products.category stores slug)
export const productCategories = pgTable("product_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const insertCategorySchema = createInsertSchema(productCategories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type ProductCategory = typeof productCategories.$inferSelect;

// Legacy: keep for backward compatibility where enum is used
export const categoryEnum = ["vetement", "chaussures", "autre"] as const;
export type Category = typeof categoryEnum[number];

// Main categories (dynamic: Homme, Femme, Enfant, etc.) – stored in DB, used in nav/filters
export const mainCategories = pgTable("main_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
  imageUrl: text("image_url"),
});

export const insertMainCategorySchema = createInsertSchema(mainCategories).omit({ id: true });
export type InsertMainCategory = z.infer<typeof insertMainCategorySchema>;
export type MainCategoryRow = typeof mainCategories.$inferSelect;

// Fallback enum for validation when no DB (backward compat)
export const mainCategoryEnum = ["homme", "femme", "enfant"] as const;
export type MainCategory = (typeof mainCategoryEnum)[number];

// Size types
export const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const shoeSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] as const;

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  mainCategory: text("main_category").notNull().default("homme"), // homme | femme | enfant
  category: text("category").notNull(), // slug from product_categories (subcategory)
  color: text("color"), // optional, for filter (e.g. Noir, Blanc, Bleu)
  imageUrl: text("image_url"),
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }).notNull(),
  isPublished: boolean("is_published").notNull().default(false), // storefront visibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suggested colors for product + filter (optional, can be extended)
export const productColorOptions = ["Noir", "Blanc", "Bleu", "Rouge", "Vert", "Gris", "Marron", "Beige", "Jaune", "Rose", "Autre"] as const;

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true, createdAt: true })
  .extend({
    mainCategory: z.string().min(1),
    defaultPrice: z.union([z.string(), z.number()]).transform((v) =>
      typeof v === "number" ? String(v) : String(Number(v))
    ),
  });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Product Variants table (for sizes and quantities)
export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull().default(0),
});

export const insertProductVariantSchema = createInsertSchema(productVariants).omit({
  id: true,
});

export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;

// Product images (up to 6 per product, ordered by position)
export const productImages = pgTable("product_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  position: integer("position").notNull().default(0),
});

export type ProductImage = typeof productImages.$inferSelect;

// Storefront orders (SaaS 2 – no auth; first_name + optional phone/email)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // 'paid' | 'partial' | 'unpaid'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;

// Storefront order items (price snapshot at order time)
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  variantId: varchar("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  priceAtTime: decimal("price_at_time", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;

/** Order with items for back-office display */
export type OrderWithDetails = Order & {
  items: (OrderItem & { productName?: string; size?: string })[];
};

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Payment status enum
export const paymentStatusEnum = ["paid", "unpaid", "partial"] as const;
export type PaymentStatus = typeof paymentStatusEnum[number];

// Sales table
export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  customerName: text("customer_name"), // Simple name for quick sales without creating a full client
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("paid"), // paid, unpaid, partial
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

// Sale Items table
export const saleItems = pgTable("sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productVariantId: varchar("product_variant_id").notNull().references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
});

export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;

// Stock Movements table
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productVariantId: varchar("product_variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "in" or "out"
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({
  id: true,
  createdAt: true,
});

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Estimates table
export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft, sent, accepted, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEstimateSchema = createInsertSchema(estimates).omit({
  id: true,
  createdAt: true,
});

export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type Estimate = typeof estimates.$inferSelect;

// Estimate Items table
export const estimateItems = pgTable("estimate_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  estimateId: varchar("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  supplierPrice: decimal("supplier_price", { precision: 10, scale: 2 }).notNull(),
  commissionType: text("commission_type").notNull().default("percentage"), // percentage or fixed
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
});

export const insertEstimateItemSchema = createInsertSchema(estimateItems).omit({
  id: true,
});

export type InsertEstimateItem = z.infer<typeof insertEstimateItemSchema>;
export type EstimateItem = typeof estimateItems.$inferSelect;

// Extended types for frontend use
export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  totalStock: number;
  images?: ProductImage[];
};

export type SaleWithDetails = Sale & {
  client?: Client | null;
  customerName?: string | null;
  paidAmount: string;
  paymentStatus: string;
  remainingAmount: number;
  items: (SaleItem & {
    variant: ProductVariant & {
      product: Product;
    };
  })[];
};

export type EstimateWithDetails = Estimate & {
  client?: Client | null;
  items: EstimateItem[];
  totalSupplierPrice: number;
  totalCommission: number;
  totalClientPrice: number;
};

export type ClientWithStats = Client & {
  totalSpent: number;
  purchaseCount: number;
};

/** A "virtual client" derived from storefront orders, grouped by identity (phone > email > name). */
export type StorefrontClientSummary = {
  id: string;           // synthetic key: "sc_{phone|email|name}"
  name: string;
  phone: string | null;
  email: string | null;
  source: "storefront";
  orderCount: number;
  totalSpent: number;
  paidAmount: number;
  toCollect: number;
  orders: Order[];
};
