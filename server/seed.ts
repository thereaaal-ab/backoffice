import { db } from "./db";
import { productCategories, products, productVariants, clients, sales, saleItems, estimates, estimateItems } from "@shared/schema";
import { sql } from "drizzle-orm";

const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const shoeSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

const defaultCategories = [
  { slug: "vetement", name: "Vêtements" },
  { slug: "chaussures", name: "Chaussures" },
  { slug: "autre", name: "Autre" },
];

export async function seedDatabase() {
  if (!db) {
    console.log("⚠️  Seed skipped — no database connection.");
    return;
  }
  try {
    // Always ensure default categories exist
    const existingCategories = await db.select().from(productCategories);
    const existingSlugs = new Set(existingCategories.map((c) => c.slug));
    for (const cat of defaultCategories) {
      if (!existingSlugs.has(cat.slug)) {
        await db.insert(productCategories).values(cat);
        existingSlugs.add(cat.slug);
      }
    }

    // Check if products already exist
    const existingProducts = await db.select().from(products).limit(1);
    if (existingProducts.length > 0) {
      console.log("Database already seeded, skipping products...");
      return;
    }

    console.log("Seeding database with sample data...");

    // Seed Products
    const [tshirtNike] = await db.insert(products).values({
      name: "T-shirt Nike Dri-FIT",
      category: "vetement",
      defaultPrice: "45.00",
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop",
    }).returning();

    const [jeansLevis] = await db.insert(products).values({
      name: "Jean Levi's 501",
      category: "vetement",
      defaultPrice: "89.00",
      imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=300&fit=crop",
    }).returning();

    const [pullRalph] = await db.insert(products).values({
      name: "Pull Ralph Lauren",
      category: "vetement",
      defaultPrice: "125.00",
      imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=300&fit=crop",
    }).returning();

    const [airMax] = await db.insert(products).values({
      name: "Nike Air Max 90",
      category: "chaussures",
      defaultPrice: "159.00",
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop",
    }).returning();

    const [stanSmith] = await db.insert(products).values({
      name: "Adidas Stan Smith",
      category: "chaussures",
      defaultPrice: "99.00",
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=300&fit=crop",
    }).returning();

    // Seed Variants for clothing
    for (const product of [tshirtNike, jeansLevis, pullRalph]) {
      for (const size of clothingSizes) {
        await db.insert(productVariants).values({
          productId: product.id,
          size,
          quantity: Math.floor(Math.random() * 10) + 2,
        });
      }
    }

    // Seed Variants for shoes
    for (const product of [airMax, stanSmith]) {
      for (const size of shoeSizes) {
        await db.insert(productVariants).values({
          productId: product.id,
          size,
          quantity: Math.floor(Math.random() * 5) + 1,
        });
      }
    }

    // Seed Clients
    const [clientMarc] = await db.insert(clients).values({
      name: "Marc Dubois",
      phone: "06 12 34 56 78",
      email: "marc.dubois@email.com",
      notes: "Bon client, aime les marques premium",
    }).returning();

    const [clientSophie] = await db.insert(clients).values({
      name: "Sophie Martin",
      phone: "06 98 76 54 32",
      email: "sophie.martin@email.com",
      notes: "Préfère les paiements en plusieurs fois",
    }).returning();

    const [clientPierre] = await db.insert(clients).values({
      name: "Pierre Leroy",
      phone: "06 11 22 33 44",
      email: "pierre.leroy@email.com",
      notes: "Ami proche - tarif préférentiel",
    }).returning();

    const [clientEmilie] = await db.insert(clients).values({
      name: "Emilie Bernard",
      phone: "06 55 66 77 88",
      email: "emilie.b@email.com",
      notes: "",
    }).returning();

    // Get some variants for sales
    const allVariants = await db.select().from(productVariants);
    const tshirtVariantM = allVariants.find(v => v.productId === tshirtNike.id && v.size === "M");
    const jeansVariantL = allVariants.find(v => v.productId === jeansLevis.id && v.size === "L");
    const airMaxVariant42 = allVariants.find(v => v.productId === airMax.id && v.size === "42");

    // Seed Sales
    if (tshirtVariantM && jeansVariantL) {
      const [sale1] = await db.insert(sales).values({
        clientId: clientMarc.id,
        totalAmount: "134.00",
      }).returning();

      await db.insert(saleItems).values({
        saleId: sale1.id,
        productVariantId: tshirtVariantM.id,
        quantity: 1,
        unitPrice: "45.00",
      });

      await db.insert(saleItems).values({
        saleId: sale1.id,
        productVariantId: jeansVariantL.id,
        quantity: 1,
        unitPrice: "89.00",
      });

      // Update stock
      await db.execute(sql`UPDATE product_variants SET quantity = quantity - 1 WHERE id = ${tshirtVariantM.id}`);
      await db.execute(sql`UPDATE product_variants SET quantity = quantity - 1 WHERE id = ${jeansVariantL.id}`);
    }

    if (airMaxVariant42) {
      const [sale2] = await db.insert(sales).values({
        clientId: clientSophie.id,
        totalAmount: "159.00",
      }).returning();

      await db.insert(saleItems).values({
        saleId: sale2.id,
        productVariantId: airMaxVariant42.id,
        quantity: 1,
        unitPrice: "159.00",
      });

      // Update stock
      await db.execute(sql`UPDATE product_variants SET quantity = quantity - 1 WHERE id = ${airMaxVariant42.id}`);
    }

    // Seed Estimates
    const [estimate1] = await db.insert(estimates).values({
      clientId: clientPierre.id,
      status: "sent",
    }).returning();

    await db.insert(estimateItems).values([
      {
        estimateId: estimate1.id,
        productName: "Veste Moncler",
        quantity: 1,
        supplierPrice: "450.00",
        commissionType: "percentage",
        commissionValue: "15.00",
        finalPrice: "517.50",
      },
      {
        estimateId: estimate1.id,
        productName: "Bonnet Moncler",
        quantity: 2,
        supplierPrice: "85.00",
        commissionType: "fixed",
        commissionValue: "20.00",
        finalPrice: "105.00",
      },
    ]);

    const [estimate2] = await db.insert(estimates).values({
      clientId: clientEmilie.id,
      status: "draft",
    }).returning();

    await db.insert(estimateItems).values([
      {
        estimateId: estimate2.id,
        productName: "Sac Louis Vuitton Neverfull",
        quantity: 1,
        supplierPrice: "1200.00",
        commissionType: "percentage",
        commissionValue: "10.00",
        finalPrice: "1320.00",
      },
    ]);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
