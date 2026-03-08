import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  users,
  productCategories,
  products,
  productVariants,
  productImages,
  clients,
  sales,
  saleItems,
  stockMovements,
  estimates,
  estimateItems,
  orders,
  orderItems,
  type User,
  type InsertUser,
  type ProductCategory,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type ProductVariant,
  type InsertProductVariant,
  type Client,
  type InsertClient,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type StockMovement,
  type InsertStockMovement,
  type Estimate,
  type InsertEstimate,
  type EstimateItem,
  type InsertEstimateItem,
  type Order,
  type OrderItem,
  type ProductWithVariants,
  type SaleWithDetails,
  type EstimateWithDetails,
  type ClientWithStats,
  type OrderWithDetails,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Categories
  getCategories(): Promise<ProductCategory[]>;
  createCategory(category: InsertCategory): Promise<ProductCategory>;

  // Products
  getProducts(): Promise<ProductWithVariants[]>;
  getProduct(id: string): Promise<ProductWithVariants | undefined>;
  createProduct(product: InsertProduct, variants?: InsertProductVariant[], imageUrls?: string[]): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>, imageUrls?: string[]): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  
  // Product Variants
  getVariant(id: string): Promise<ProductVariant | undefined>;
  updateVariantStock(id: string, quantity: number, type: "in" | "out", reason?: string): Promise<void>;
  
  // Clients
  getClients(): Promise<ClientWithStats[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  // Sales
  getSales(): Promise<SaleWithDetails[]>;
  getSale(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  updateSalePayment(id: string, additionalAmount: number): Promise<Sale>;
  deleteSale(id: string): Promise<void>;
  
  // Estimates
  getEstimates(): Promise<EstimateWithDetails[]>;
  getEstimate(id: string): Promise<EstimateWithDetails | undefined>;
  createEstimate(estimate: InsertEstimate, items: InsertEstimateItem[]): Promise<Estimate>;
  updateEstimateStatus(id: string, status: string): Promise<Estimate>;
  deleteEstimate(id: string): Promise<void>;
  
  // Storefront orders (back-office tracking)
  getOrders(): Promise<Order[]>;
  getOrderWithDetails(id: string): Promise<OrderWithDetails | undefined>;
  updateOrderPayment(id: string, additionalPaidAmount: number): Promise<Order>;
  getStorefrontClients(): Promise<import("@shared/schema").StorefrontClientSummary[]>;

  // Backoffice client detail
  getClientSales(clientId: string): Promise<import("@shared/schema").SaleWithDetails[]>;

  // Dashboard
  getDashboardStats(): Promise<{
    totalProducts: number;
    totalStock: number;
    totalClients: number;
    totalSales: number;
    totalRevenue: number;
    amountCollected: number;
    amountToCollect: number;
    salesWithBalance: number;
    averageBasket: number;
    pendingEstimates: number;
    recentSales: Array<{ id: string; clientName: string; amount: string; date: string }>;
    lowStockProducts: Array<{ id: string; name: string; totalStock: number }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Categories
  async getCategories(): Promise<ProductCategory[]> {
    return db.select().from(productCategories).orderBy(productCategories.name);
  }

  async createCategory(category: InsertCategory): Promise<ProductCategory> {
    const [created] = await db.insert(productCategories).values(category).returning();
    if (!created) {
      throw new Error("Category insert did not return a row");
    }
    return created;
  }

  // Products
  async getProducts(): Promise<ProductWithVariants[]> {
    const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));
    const allVariants = await db.select().from(productVariants);
    const allImages = await db.select().from(productImages).orderBy(productImages.position);

    return allProducts.map((product) => {
      const variants = allVariants.filter((v) => v.productId === product.id);
      const totalStock = variants.reduce((sum, v) => sum + v.quantity, 0);
      const images = allImages.filter((img) => img.productId === product.id);
      return { ...product, variants, totalStock, images };
    });
  }

  async getProduct(id: string): Promise<ProductWithVariants | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return undefined;

    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
    const totalStock = variants.reduce((sum, v) => sum + v.quantity, 0);
    const images = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);

    return { ...product, variants, totalStock, images };
  }

  async createProduct(
    product: InsertProduct,
    variants: InsertProductVariant[] = [],
    imageUrls: string[] = []
  ): Promise<Product> {
    const urls = imageUrls.slice(0, 6).filter(Boolean);
    const productToInsert = {
      ...product,
      imageUrl: product.imageUrl ?? urls[0] ?? undefined,
    };
    const [newProduct] = await db.insert(products).values(productToInsert).returning();

    if (variants.length > 0) {
      const variantsWithProductId = variants.map((v) => ({
        ...v,
        productId: newProduct.id,
      }));
      await db.insert(productVariants).values(variantsWithProductId);
    }

    if (urls.length > 0) {
      await db.insert(productImages).values(
        urls.map((imageUrl, index) => ({
          productId: newProduct.id,
          imageUrl,
          position: index,
        }))
      );
    }

    return newProduct;
  }

  async updateProduct(
    id: string,
    productData: Partial<InsertProduct>,
    imageUrls?: string[]
  ): Promise<Product> {
    if (imageUrls !== undefined) {
      const urls = imageUrls.slice(0, 6).filter(Boolean);
      await db.delete(productImages).where(eq(productImages.productId, id));
      if (urls.length > 0) {
        await db.insert(productImages).values(
          urls.map((imageUrl, index) => ({
            productId: id,
            imageUrl,
            position: index,
          }))
        );
      }
      (productData as Record<string, unknown>).imageUrl = productData.imageUrl ?? urls[0] ?? undefined;
    }
    const [updated] = await db
      .update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    if (!updated) throw new Error("Product not found");
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    const referencedByOrders = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.productId, id))
      .limit(1);
    if (referencedByOrders.length > 0) {
      throw new Error(
        "Ce produit ne peut pas être supprimé : il figure dans au moins une commande."
      );
    }
    await db.delete(productImages).where(eq(productImages.productId, id));
    await db.delete(productVariants).where(eq(productVariants.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  // Product Variants
  async getVariant(id: string): Promise<ProductVariant | undefined> {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, id));
    return variant;
  }

  async updateVariantStock(id: string, quantity: number, type: "in" | "out", reason?: string): Promise<void> {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, id));
    if (!variant) throw new Error("Variant not found");
    
    const newQuantity = type === "in" ? variant.quantity + quantity : variant.quantity - quantity;
    if (newQuantity < 0) throw new Error("Insufficient stock");
    
    await db.update(productVariants)
      .set({ quantity: newQuantity })
      .where(eq(productVariants.id, id));
    
    await db.insert(stockMovements).values({
      productVariantId: id,
      type,
      quantity,
      reason,
    });
  }

  // Clients
  async getClients(): Promise<ClientWithStats[]> {
    const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));
    
    const clientStats = await db
      .select({
        clientId: sales.clientId,
        totalSpent: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)`,
        purchaseCount: sql<number>`COUNT(${sales.id})`,
      })
      .from(sales)
      .groupBy(sales.clientId);
    
    return allClients.map(client => {
      const stats = clientStats.find(s => s.clientId === client.id);
      return {
        ...client,
        totalSpent: stats?.totalSpent ? Number(stats.totalSpent) : 0,
        purchaseCount: stats?.purchaseCount ? Number(stats.purchaseCount) : 0,
      };
    });
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, clientData: Partial<InsertClient>): Promise<Client> {
    const [updated] = await db.update(clients)
      .set(clientData)
      .where(eq(clients.id, id))
      .returning();
    if (!updated) throw new Error("Client not found");
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Sales
  async getSales(): Promise<SaleWithDetails[]> {
    const allSales = await db.select().from(sales).orderBy(desc(sales.createdAt));
    const allClients = await db.select().from(clients);
    const allSaleItems = await db.select().from(saleItems);
    const allVariants = await db.select().from(productVariants);
    const allProducts = await db.select().from(products);
    
    return allSales.map(sale => {
      const client = allClients.find(c => c.id === sale.clientId) || null;
      const items = allSaleItems
        .filter(item => item.saleId === sale.id)
        .map(item => {
          const variant = allVariants.find(v => v.id === item.productVariantId)!;
          const product = allProducts.find(p => p.id === variant?.productId)!;
          return {
            ...item,
            variant: {
              ...variant,
              product,
            },
          };
        });
      
      const remainingAmount = Number(sale.totalAmount) - Number(sale.paidAmount || 0);
      
      return { 
        ...sale, 
        client, 
        items,
        paidAmount: sale.paidAmount || "0",
        paymentStatus: sale.paymentStatus || "paid",
        remainingAmount,
      };
    });
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale;
  }

  async createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale> {
    const [newSale] = await db.insert(sales).values(sale).returning();
    
    for (const item of items) {
      await db.insert(saleItems).values({
        ...item,
        saleId: newSale.id,
      });
      
      // Decrement stock
      await this.updateVariantStock(item.productVariantId, item.quantity, "out", "Vente");
    }
    
    return newSale;
  }

  async updateSalePayment(id: string, additionalAmount: number): Promise<Sale> {
    const sale = await this.getSale(id);
    if (!sale) throw new Error("Sale not found");
    
    const currentPaid = Number(sale.paidAmount || 0);
    const total = Number(sale.totalAmount);
    const newPaidAmount = Math.min(currentPaid + additionalAmount, total);
    
    let newStatus = sale.paymentStatus;
    if (newPaidAmount >= total) {
      newStatus = "paid";
    } else if (newPaidAmount > 0) {
      newStatus = "partial";
    }
    
    const [updated] = await db.update(sales)
      .set({ 
        paidAmount: newPaidAmount.toFixed(2),
        paymentStatus: newStatus,
      })
      .where(eq(sales.id, id))
      .returning();
    
    return updated;
  }

  async deleteSale(id: string): Promise<void> {
    await db.delete(sales).where(eq(sales.id, id));
  }

  // Estimates
  async getEstimates(): Promise<EstimateWithDetails[]> {
    const allEstimates = await db.select().from(estimates).orderBy(desc(estimates.createdAt));
    const allClients = await db.select().from(clients);
    const allEstimateItems = await db.select().from(estimateItems);
    
    return allEstimates.map(estimate => {
      const client = allClients.find(c => c.id === estimate.clientId) || null;
      const items = allEstimateItems.filter(item => item.estimateId === estimate.id);
      
      const totalSupplierPrice = items.reduce((sum, item) => 
        sum + (Number(item.supplierPrice) * item.quantity), 0);
      const totalClientPrice = items.reduce((sum, item) => 
        sum + (Number(item.finalPrice) * item.quantity), 0);
      const totalCommission = totalClientPrice - totalSupplierPrice;
      
      return { ...estimate, client, items, totalSupplierPrice, totalCommission, totalClientPrice };
    });
  }

  async getEstimate(id: string): Promise<EstimateWithDetails | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    if (!estimate) return undefined;
    
    const [client] = estimate.clientId 
      ? await db.select().from(clients).where(eq(clients.id, estimate.clientId))
      : [null];
    
    const items = await db.select().from(estimateItems).where(eq(estimateItems.estimateId, id));
    
    const totalSupplierPrice = items.reduce((sum, item) => 
      sum + (Number(item.supplierPrice) * item.quantity), 0);
    const totalClientPrice = items.reduce((sum, item) => 
      sum + (Number(item.finalPrice) * item.quantity), 0);
    const totalCommission = totalClientPrice - totalSupplierPrice;
    
    return { ...estimate, client, items, totalSupplierPrice, totalCommission, totalClientPrice };
  }

  async createEstimate(estimate: InsertEstimate, items: InsertEstimateItem[]): Promise<Estimate> {
    const [newEstimate] = await db.insert(estimates).values(estimate).returning();
    
    if (items.length > 0) {
      const itemsWithEstimateId = items.map(item => ({
        ...item,
        estimateId: newEstimate.id,
      }));
      await db.insert(estimateItems).values(itemsWithEstimateId);
    }
    
    return newEstimate;
  }

  async updateEstimateStatus(id: string, status: string): Promise<Estimate> {
    const [updated] = await db.update(estimates)
      .set({ status })
      .where(eq(estimates.id, id))
      .returning();
    if (!updated) throw new Error("Estimate not found");
    return updated;
  }

  async deleteEstimate(id: string): Promise<void> {
    await db.delete(estimates).where(eq(estimates.id, id));
  }

  // Storefront orders (back-office tracking)
  async getOrders(): Promise<Order[]> {
    const list = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return list;
  }

  async getOrderWithDetails(id: string): Promise<OrderWithDetails | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const itemsWithNames: (OrderItem & { productName?: string; size?: string })[] = await Promise.all(
      items.map(async (item) => {
        const [p] = await db.select({ name: products.name }).from(products).where(eq(products.id, item.productId));
        let size: string | undefined;
        if (item.variantId) {
          const [v] = await db.select({ size: productVariants.size }).from(productVariants).where(eq(productVariants.id, item.variantId));
          size = v?.size;
        }
        return { ...item, productName: p?.name, size };
      })
    );
    return { ...order, items: itemsWithNames };
  }

  async updateOrderPayment(id: string, additionalPaidAmount: number): Promise<Order> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) throw new Error("Order not found");
    const totalAmount = Number(order.totalAmount);
    const currentPaid = Number(order.paidAmount);
    const newPaid = currentPaid + additionalPaidAmount;
    const newPaidClamped = Math.min(totalAmount, Math.max(0, newPaid));
    const paymentStatus = newPaidClamped >= totalAmount ? "paid" : newPaidClamped > 0 ? "partial" : "unpaid";
    const [updated] = await db
      .update(orders)
      .set({
        paidAmount: String(newPaidClamped.toFixed(2)),
        paymentStatus,
      })
      .where(eq(orders.id, id))
      .returning();
    if (!updated) throw new Error("Order not found");
    return updated;
  }

  async getStorefrontClients(): Promise<import("@shared/schema").StorefrontClientSummary[]> {
    const allOrders = await this.getOrders();
    const map = new Map<string, Order[]>();
    for (const o of allOrders) {
      const raw = o as Record<string, unknown>;
      const phone = ((raw.phone ?? "") as string).trim();
      const email = ((raw.email ?? "") as string).trim();
      const name = ((raw.firstName ?? raw.first_name ?? "") as string).trim();
      const key = phone || email || name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries()).map(([key, clientOrders]) => {
      const first = clientOrders[0] as Record<string, unknown>;
      const name = ((first.firstName ?? first.first_name ?? "") as string).trim();
      const phone = ((first.phone ?? "") as string).trim() || null;
      const email = ((first.email ?? "") as string).trim() || null;
      const totalSpent = clientOrders.reduce((s, o) => {
        const r = o as Record<string, unknown>;
        return s + Number(r.totalAmount ?? r.total_amount ?? 0);
      }, 0);
      const paidAmount = clientOrders.reduce((s, o) => {
        const r = o as Record<string, unknown>;
        return s + Number(r.paidAmount ?? r.paid_amount ?? 0);
      }, 0);
      return {
        id: `sc_${encodeURIComponent(key)}`,
        name,
        phone,
        email,
        source: "storefront" as const,
        orderCount: clientOrders.length,
        totalSpent,
        paidAmount,
        toCollect: totalSpent - paidAmount,
        orders: clientOrders,
      };
    });
  }

  async getClientSales(clientId: string): Promise<import("@shared/schema").SaleWithDetails[]> {
    const allSales = await db
      .select()
      .from(sales)
      .where(eq(sales.clientId, clientId))
      .orderBy(desc(sales.createdAt));
    if (!allSales.length) return [];
    const allSaleItems = await db.select().from(saleItems).where(
      sql`${saleItems.saleId} IN (${sql.join(allSales.map(s => sql`${s.id}`), sql`, `)})`
    );
    const allVariants = await db.select().from(productVariants);
    const allProducts = await db.select().from(products);
    const [clientRow] = await db.select().from(clients).where(eq(clients.id, clientId));
    return allSales.map(sale => {
      const items = allSaleItems
        .filter(item => item.saleId === sale.id)
        .map(item => {
          const variant = allVariants.find(v => v.id === item.productVariantId)!;
          const product = allProducts.find(p => p.id === variant?.productId)!;
          return { ...item, variant: { ...variant, product } };
        });
      return {
        ...sale,
        client: clientRow ?? null,
        items,
        paidAmount: sale.paidAmount || "0",
        paymentStatus: sale.paymentStatus || "paid",
        remainingAmount: Number(sale.totalAmount) - Number(sale.paidAmount || 0),
      };
    });
  }

  // Dashboard (sales + storefront orders)
  async getDashboardStats() {
    const allProducts = await this.getProducts();
    const allClients = await db.select().from(clients);
    const allSales = await this.getSales();
    const allOrders = await this.getOrders();
    const allEstimates = await this.getEstimates();
    
    const allStorefrontClients = await this.getStorefrontClients();
    const totalProducts = allProducts.length;
    const totalStock = allProducts.reduce((sum, p) => sum + p.totalStock, 0);
    const totalClients = allClients.length + allStorefrontClients.length;
    const totalSales = allSales.length;
    const salesRevenue = allSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const salesCollected = allSales.reduce((sum, s) => sum + Number(s.paidAmount ?? 0), 0);
    const orderTotal = (o: Order) => Number((o as Record<string, unknown>).totalAmount ?? (o as Record<string, unknown>).total_amount ?? 0);
    const orderPaid = (o: Order) => Number((o as Record<string, unknown>).paidAmount ?? (o as Record<string, unknown>).paid_amount ?? 0);
    const ordersRevenue = allOrders.reduce((sum, o) => sum + orderTotal(o), 0);
    const ordersCollected = allOrders.reduce((sum, o) => sum + orderPaid(o), 0);
    const totalRevenue = salesRevenue + ordersRevenue;
    const amountCollected = salesCollected + ordersCollected;
    const amountToCollect = totalRevenue - amountCollected;
    const salesWithBalance = allSales.filter(s => Number(s.paidAmount ?? 0) < Number(s.totalAmount)).length;
    const ordersWithBalance = allOrders.filter(o => orderPaid(o) < orderTotal(o)).length;
    const totalWithBalance = salesWithBalance + ordersWithBalance;
    const totalTransactions = totalSales + allOrders.length;
    const averageBasket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const pendingEstimates = allEstimates.filter(e => e.status === "draft" || e.status === "sent").length;
    
    const recentSales = allSales.slice(0, 5).map(sale => ({
      id: sale.id,
      clientName: sale.client?.name || sale.customerName || "Client anonyme",
      amount: Number(sale.totalAmount).toFixed(2),
      date: new Date(sale.createdAt).toLocaleDateString("fr-FR"),
    }));
    
    const lowStockProducts = allProducts
      .filter(p => p.totalStock > 0 && p.totalStock <= 5)
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        name: p.name,
        totalStock: p.totalStock,
      }));
    
    return {
      totalProducts,
      totalStock,
      totalClients,
      totalSales,
      totalRevenue,
      amountCollected,
      amountToCollect,
      salesWithBalance: totalWithBalance,
      averageBasket,
      pendingEstimates,
      recentSales,
      lowStockProducts,
    };
  }
}

class NullStorage implements IStorage {
  private warn() { console.warn("⚠️  NullStorage: DATABASE_URL not set — returning empty data"); }
  async getUser() { return undefined; }
  async getUserByUsername() { return undefined; }
  async createUser(u: InsertUser): Promise<User> { this.warn(); return { ...u, id: "0", createdAt: new Date() } as User; }
  async getCategories() { return []; }
  async createCategory(c: InsertCategory): Promise<ProductCategory> { this.warn(); return { ...c, id: "0" } as ProductCategory; }
  async getProducts() { return []; }
  async getProduct() { return undefined; }
  async createProduct(p: InsertProduct): Promise<Product> { this.warn(); return { ...p, id: "0", createdAt: new Date() } as unknown as Product; }
  async updateProduct(_id: string, p: Partial<InsertProduct>): Promise<Product> { this.warn(); return { ...p, id: _id } as unknown as Product; }
  async deleteProduct() { this.warn(); }
  async getVariant() { return undefined; }
  async updateVariantStock() { this.warn(); }
  async getClients() { return []; }
  async getClient() { return undefined; }
  async createClient(c: InsertClient): Promise<Client> { this.warn(); return { ...c, id: "0", createdAt: new Date() } as Client; }
  async updateClient(_id: string, c: Partial<InsertClient>): Promise<Client> { this.warn(); return { ...c, id: _id } as unknown as Client; }
  async deleteClient() { this.warn(); }
  async getSales() { return []; }
  async getSale() { return undefined; }
  async createSale(s: InsertSale): Promise<Sale> { this.warn(); return { ...s, id: "0", createdAt: new Date() } as unknown as Sale; }
  async updateSalePayment(_id: string): Promise<Sale> { this.warn(); return {} as Sale; }
  async deleteSale() { this.warn(); }
  async getEstimates() { return []; }
  async getEstimate() { return undefined; }
  async createEstimate(e: InsertEstimate): Promise<Estimate> { this.warn(); return { ...e, id: "0", createdAt: new Date() } as unknown as Estimate; }
  async updateEstimateStatus(_id: string): Promise<Estimate> { this.warn(); return {} as Estimate; }
  async deleteEstimate() { this.warn(); }
  async getOrders() { return []; }
  async getOrderWithDetails() { return undefined; }
  async updateOrderPayment(_id: string): Promise<Order> { this.warn(); return {} as Order; }
  async getStorefrontClients() { this.warn(); return []; }
  async getClientSales() { this.warn(); return []; }
  async getDashboardStats() {
    return {
      totalProducts: 0,
      totalStock: 0,
      totalClients: 0,
      totalSales: 0,
      totalRevenue: 0,
      amountCollected: 0,
      amountToCollect: 0,
      salesWithBalance: 0,
      averageBasket: 0,
      pendingEstimates: 0,
      recentSales: [],
      lowStockProducts: [],
    };
  }
}

export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new NullStorage();
