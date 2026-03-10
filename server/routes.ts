import express, { type Express } from "express";
import path from "path";
import fs from "fs";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertProductSchema, insertClientSchema, insertCategorySchema, insertMainCategorySchema } from "@shared/schema";
import { z } from "zod";
import * as XLSX from "xlsx";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { uploadToSupabaseStorage, isSupabaseStorageConfigured } from "./supabaseStorage";
import { requireAuth, verifyPassword, type AuthUser } from "./auth";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Validation schemas for sale and estimate items
const saleItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

const createSaleSchema = z.object({
  clientId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1),
  paymentStatus: z.enum(["paid", "unpaid", "partial"]).default("paid"),
  paidAmount: z.number().nonnegative().optional(),
});

const estimateItemSchema = z.object({
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  supplierPrice: z.number().nonnegative(),
  commissionType: z.enum(["percentage", "fixed"]),
  commissionValue: z.number().nonnegative(),
  finalPrice: z.number().positive(),
});

const createEstimateSchema = z.object({
  clientId: z.string().optional().nullable(),
  items: z.array(estimateItemSchema).min(1),
});

const stockUpdateSchema = z.object({
  quantity: z.number().int().positive(),
  type: z.enum(["in", "out"]),
});

const updatePaymentSchema = z.object({
  additionalAmount: z.number().positive(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register object storage routes for image uploads
  registerObjectStorageRoutes(app);

  // Static serving for legacy /uploads/ paths (e.g. old product images before Supabase)
  app.use("/uploads", express.static(uploadsDir));

  // ─── Auth (no requireAuth) ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "Identifiant et mot de passe requis" });
      }
      const user = await storage.getUserByUsername(username.trim());
      if (!user) {
        return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
      }
      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
      }
      (req.session as { userId?: string; username?: string }).userId = user.id;
      (req.session as { userId?: string; username?: string }).username = user.username;
      const authUser: AuthUser = { id: user.id, username: user.username };
      res.json({ user: authUser });
    } catch (err) {
      console.error("[POST /api/auth/login]", err);
      res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as { userId?: string })?.userId;
    if (!userId) {
      return res.status(200).json({ user: null });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(200).json({ user: null });
    }
    res.json({ user: { id: user.id, username: user.username } as AuthUser });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[POST /api/auth/logout]", err);
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      res.json({ ok: true });
    });
  });

  // Protect all other /api routes (except auth and static)
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth")) return next();
    requireAuth(req, res, next);
  });

  // Upload to Supabase Storage (product images); returns public URL as objectPath
  app.post("/api/uploads", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!isSupabaseStorageConfigured()) {
      return res.status(503).json({
        error: "Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.",
      });
    }
    const buffer = req.file.buffer;
    const result = await uploadToSupabaseStorage(
      buffer,
      req.file.originalname,
      req.file.mimetype
    );
    if (!result) {
      return res.status(500).json({ error: "Failed to upload to Supabase Storage" });
    }
    res.json({
      objectPath: result.publicUrl,
      metadata: {
        name: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
      },
    });
  });

  // Main categories (Homme, Femme, Enfant – dynamic, no code change to add more)
  app.get("/api/main-categories", async (req, res) => {
    try {
      const list = await storage.getMainCategories();
      res.json(list);
    } catch (error) {
      console.error("Error fetching main categories:", error);
      res.status(500).json({ error: "Failed to fetch main categories" });
    }
  });

  app.post("/api/main-categories", async (req, res) => {
    try {
      const raw = { ...req.body };
      if (raw.label && typeof raw.label === "string" && (!raw.slug || String(raw.slug).trim() === "")) {
        raw.slug = raw.label
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || "main-" + Date.now();
      }
      const payload: Record<string, unknown> = {
        label: raw.label,
        slug: raw.slug,
        position: raw.position ?? 0,
      };
      if (raw.imageUrl != null && String(raw.imageUrl).trim() !== "") {
        payload.imageUrl = String(raw.imageUrl).trim();
      }
      let body = insertMainCategorySchema.parse(payload);
      let created;
      try {
        created = await storage.createMainCategory(body);
      } catch (createErr) {
        const errMsg = (createErr as Error).message ?? "";
        if (errMsg.includes("main_categories_slug_unique") && payload.slug) {
          payload.slug = String(payload.slug) + "-" + Date.now().toString(36).slice(-6);
          body = insertMainCategorySchema.parse(payload);
          created = await storage.createMainCategory(body);
        } else {
          throw createErr;
        }
      }
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return res.status(400).json({ error: message });
      }
      const err = error as Error;
      console.error("Error creating main category:", err.message, err);
      const safeMessage = err.message && !err.message.includes("password") ? err.message : "Failed to create main category";
      res.status(500).json({ error: safeMessage });
    }
  });

  app.patch("/api/main-categories/:id", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const update: { label?: string; slug?: string; position?: number; imageUrl?: string | null } = {};
      if (typeof body.label === "string" && body.label.trim()) update.label = body.label.trim();
      if (typeof body.slug === "string") update.slug = body.slug.trim() || undefined;
      if (typeof body.position === "number") update.position = body.position;
      if (body.imageUrl !== undefined) update.imageUrl = body.imageUrl === null || body.imageUrl === "" ? null : String(body.imageUrl);
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
      }
      const mainCategory = await storage.updateMainCategory(req.params.id, update);
      res.json(mainCategory);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Main category not found") return res.status(404).json({ error: message });
      console.error("Error updating main category:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
    }
  });

  app.delete("/api/main-categories/:id", async (req, res) => {
    try {
      await storage.deleteMainCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Main category not found") return res.status(404).json({ error: message });
      if (message.includes("utilisée par des produits")) return res.status(409).json({ error: message });
      console.error("Error deleting main category:", error);
      res.status(500).json({ error: "Impossible de supprimer la catégorie principale" });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const raw = { ...req.body };
      if (raw.name && typeof raw.name === "string" && (!raw.slug || String(raw.slug).trim() === "")) {
        raw.slug = raw.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || "categorie-" + Date.now();
      }
      const body = insertCategorySchema.parse(raw);
      const category = await storage.createCategory(body);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return res.status(400).json({ error: message });
      }
      const err = error as Error & { code?: string };
      const pgCode = err.code ?? (err as Error & { cause?: { code?: string } }).cause?.code;
      if (pgCode === "23505") {
        return res.status(409).json({
          error: "Une catégorie avec ce nom ou ce slug existe déjà.",
        });
      }
      if (pgCode === "42P01" || /relation .* does not exist/i.test(err.message)) {
        return res.status(503).json({
          error: "La table des catégories est absente. Exécutez « npm run db:push » puis redémarrez le serveur.",
        });
      }
      const message = err.message;
      const isDbOrConnectionError =
        /tenant|user not found|connection|ECONNREFUSED|ENOTFOUND|password|authentication/i.test(message);
      if (isDbOrConnectionError) {
        return res.status(503).json({
          error: "Impossible de contacter la base de données. Vérifiez DATABASE_URL (format pooler Supabase : postgres.[PROJECT_REF]@...:6543) et les identifiants.",
        });
      }
      res.status(500).json({ error: "Erreur lors de la création de la catégorie." });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const update: { name?: string; slug?: string } = {};
      if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
      if (typeof body.slug === "string") update.slug = body.slug.trim() || undefined;
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
      }
      const category = await storage.updateCategory(req.params.id, update);
      res.json(category);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Category not found") return res.status(404).json({ error: message });
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Category not found") return res.status(404).json({ error: message });
      if (message.includes("utilisée par des produits")) return res.status(409).json({ error: message });
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Impossible de supprimer la catégorie" });
    }
  });

  // Dashboard
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { variants, imageUrls, ...productData } = req.body;
      // Normalize: mainCategory (accept client camelCase or snake_case, default to homme)
      const mainCat = (productData.mainCategory ?? productData.main_category ?? "homme").trim();
      productData.mainCategory = mainCat || "homme";
      if (productData.main_category !== undefined) delete productData.main_category;
      // Coerce defaultPrice, empty imageUrl to undefined
      if (productData.defaultPrice != null) {
        productData.defaultPrice = Number(productData.defaultPrice);
      }
      if (productData.imageUrl === "") {
        productData.imageUrl = undefined;
      }
      if (productData.color === "") {
        productData.color = undefined;
      }
      if (productData.isPublished === undefined) {
        productData.isPublished = false;
      }
      const validatedProduct = insertProductSchema.parse(productData);
      const urls = Array.isArray(imageUrls) ? imageUrls.slice(0, 6).filter(Boolean) : [];

      const product = await storage.createProduct(validatedProduct, variants || [], urls);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return res.status(400).json({ error: "Invalid product data", details: message });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update Product
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const body = { ...req.body };
      const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 6).filter(Boolean) : undefined;
      if (imageUrls !== undefined) delete body.imageUrls;
      if (body.color === "") body.color = undefined;
      if (body.imageUrl === "") body.imageUrl = undefined;
      const partialProduct = insertProductSchema.partial().parse(body);
      const product = await storage.updateProduct(req.params.id, partialProduct, imageUrls);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete Product
  app.delete("/api/products/:id", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete product";
      if (message.includes("commande")) {
        return res.status(400).json({ error: message });
      }
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product", details: message });
    }
  });

  // Product Variants - Stock update
  app.post("/api/variants/:id/stock", async (req, res) => {
    try {
      const validated = stockUpdateSchema.parse(req.body);
      await storage.updateVariantStock(req.params.id, validated.quantity, validated.type);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating stock:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Clients
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validatedClient = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedClient);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  // Update Client
  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const partialClient = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, partialClient);
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete Client
  app.delete("/api/clients/:id", async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Backoffice client sales history
  app.get("/api/clients/:id/sales", async (req, res) => {
    try {
      const clientSales = await storage.getClientSales(req.params.id);
      res.json(clientSales);
    } catch (error) {
      console.error("Error fetching client sales:", error);
      res.status(500).json({ error: "Failed to fetch client sales" });
    }
  });

  // Storefront clients (derived from orders, grouped by identity)
  app.get("/api/storefront-clients", async (req, res) => {
    try {
      const sfClients = await storage.getStorefrontClients();
      res.json(sfClients);
    } catch (error) {
      console.error("Error fetching storefront clients:", error);
      res.status(500).json({ error: "Failed to fetch storefront clients" });
    }
  });

  // Sales
  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const validated = createSaleSchema.parse(req.body);
      
      const totalAmount = validated.items.reduce((sum, item) => 
        sum + (item.unitPrice * item.quantity), 0);
      
      // Determine paid amount based on payment status with server-side validation
      let paidAmount = 0;
      if (validated.paymentStatus === "paid") {
        paidAmount = totalAmount;
      } else if (validated.paymentStatus === "unpaid") {
        paidAmount = 0;
      } else if (validated.paymentStatus === "partial") {
        const requestedAmount = validated.paidAmount || 0;
        // Validate partial payment bounds
        if (requestedAmount <= 0 || requestedAmount >= totalAmount) {
          return res.status(400).json({ 
            error: "Partial payment amount must be greater than 0 and less than total amount" 
          });
        }
        paidAmount = requestedAmount;
      }
      
      const saleData = {
        clientId: validated.clientId && validated.clientId !== "anonymous" ? validated.clientId : null,
        customerName: validated.customerName || null,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        paymentStatus: validated.paymentStatus,
      };
      
      const saleItems = validated.items.map((item) => ({
        saleId: "",
        productVariantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
      }));
      
      const sale = await storage.createSale(saleData, saleItems);
      res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update Sale Payment (for follow-up payments)
  app.patch("/api/sales/:id/payment", async (req, res) => {
    try {
      const validated = updatePaymentSchema.parse(req.body);
      const updated = await storage.updateSalePayment(req.params.id, validated.additionalAmount);
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete Sale
  app.delete("/api/sales/:id", async (req, res) => {
    try {
      await storage.deleteSale(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ error: "Failed to delete sale" });
    }
  });

  // Estimates
  app.get("/api/estimates", async (req, res) => {
    try {
      const estimates = await storage.getEstimates();
      res.json(estimates);
    } catch (error) {
      console.error("Error fetching estimates:", error);
      res.status(500).json({ error: "Failed to fetch estimates" });
    }
  });

  app.get("/api/estimates/:id", async (req, res) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: "Estimate not found" });
      }
      res.json(estimate);
    } catch (error) {
      console.error("Error fetching estimate:", error);
      res.status(500).json({ error: "Failed to fetch estimate" });
    }
  });

  app.post("/api/estimates", async (req, res) => {
    try {
      const validated = createEstimateSchema.parse(req.body);
      
      const estimateData = {
        clientId: validated.clientId || null,
        status: "draft",
      };
      
      const estimateItems = validated.items.map((item) => ({
        estimateId: "",
        productName: item.productName,
        quantity: item.quantity,
        supplierPrice: item.supplierPrice.toString(),
        commissionType: item.commissionType,
        commissionValue: item.commissionValue.toString(),
        finalPrice: item.finalPrice.toString(),
      }));
      
      const estimate = await storage.createEstimate(estimateData, estimateItems);
      res.status(201).json(estimate);
    } catch (error) {
      console.error("Error creating estimate:", error);
      res.status(400).json({ error: "Invalid estimate data" });
    }
  });

  // Update Estimate Status
  app.patch("/api/estimates/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["draft", "sent", "accepted", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const estimate = await storage.updateEstimateStatus(req.params.id, status);
      res.json(estimate);
    } catch (error) {
      console.error("Error updating estimate status:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete Estimate
  app.delete("/api/estimates/:id", async (req, res) => {
    try {
      await storage.deleteEstimate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting estimate:", error);
      res.status(500).json({ error: "Failed to delete estimate" });
    }
  });

  // Normalize order row from DB (pg may return snake_case) to camelCase for frontend
  function normalizeOrderRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      firstName: row.firstName ?? row.first_name,
      phone: row.phone,
      email: row.email,
      totalAmount: row.totalAmount ?? row.total_amount ?? "0",
      paidAmount: row.paidAmount ?? row.paid_amount ?? "0",
      paymentStatus: row.paymentStatus ?? row.payment_status ?? "unpaid",
      createdAt: row.createdAt ?? row.created_at,
    };
  }
  function normalizeOrderItemRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      orderId: row.orderId ?? row.order_id,
      productId: row.productId ?? row.product_id,
      variantId: row.variantId ?? row.variant_id,
      quantity: row.quantity,
      priceAtTime: row.priceAtTime ?? row.price_at_time,
      productName: row.productName,
      size: row.size,
    };
  }

  // Storefront orders (back-office: list, detail, update payment)
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders.map((o) => normalizeOrderRow(o as Record<string, unknown>)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("[GET /api/orders] Error:", message);
      if (stack) console.error(stack);
      res.status(500).json({ error: "Failed to fetch orders", details: message });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrderWithDetails(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      const raw = order as Record<string, unknown>;
      const items = Array.isArray(raw.items)
        ? (raw.items as Record<string, unknown>[]).map(normalizeOrderItemRow)
        : [];
      res.json({ ...normalizeOrderRow(raw), items });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.delete("/api/orders/:orderId/items/:itemId", async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      await storage.deleteOrderItem(orderId, itemId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Order item not found") {
        return res.status(404).json({ error: message });
      }
      console.error("[DELETE /api/orders/:orderId/items/:itemId]", error);
      res.status(500).json({ error: "Impossible de supprimer l'article" });
    }
  });

  app.patch("/api/orders/:id/payment", async (req, res) => {
    try {
      const body = updatePaymentSchema.parse(req.body);
      const order = await storage.updateOrderPayment(req.params.id, body.additionalAmount);
      // Ensure camelCase for frontend (pg can return snake_case)
      const raw = order as Record<string, unknown>;
      res.json({
        ...order,
        paidAmount: raw.paidAmount ?? raw.paid_amount ?? "0",
        paymentStatus: raw.paymentStatus ?? raw.payment_status ?? "unpaid",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating order payment:", error);
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      await storage.deleteOrder(req.params.id);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Order not found") {
        return res.status(404).json({ error: message });
      }
      console.error("[DELETE /api/orders/:id]", error);
      res.status(500).json({ error: "Impossible de supprimer la commande" });
    }
  });

  // Excel Export for Estimates
  app.get("/api/estimates/:id/export", async (req, res) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: "Estimate not found" });
      }
      
      // Create workbook with client-visible columns only
      const clientData = estimate.items.map(item => ({
        "Produit": item.productName,
        "Quantité": item.quantity,
        "Prix unitaire (€)": Number(item.finalPrice).toFixed(2),
        "Total (€)": (Number(item.finalPrice) * item.quantity).toFixed(2),
      }));
      
      // Add total row
      const totalClientPrice = estimate.items.reduce((sum, item) => 
        sum + (Number(item.finalPrice) * item.quantity), 0);
      
      clientData.push({
        "Produit": "TOTAL",
        "Quantité": estimate.items.reduce((sum, item) => sum + item.quantity, 0),
        "Prix unitaire (€)": "",
        "Total (€)": totalClientPrice.toFixed(2),
      });
      
      const ws = XLSX.utils.json_to_sheet(clientData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Estimation");
      
      // Set column widths
      ws["!cols"] = [
        { wch: 30 }, // Produit
        { wch: 10 }, // Quantité
        { wch: 15 }, // Prix unitaire
        { wch: 12 }, // Total
      ];
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=estimation-${estimate.id}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting estimate:", error);
      res.status(500).json({ error: "Failed to export estimate" });
    }
  });

  return httpServer;
}
