import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Minus, Search, ImageIcon, Filter, Upload, X, Loader2, MoreVertical, Pencil, Trash2, FolderPlus, Settings2 } from "lucide-react";
import { PageBanner } from "@/components/page-banner";
import type { ProductWithVariants } from "@shared/schema";
import { productColorOptions } from "@shared/schema";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpload } from "@/hooks/use-upload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const shoeSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];
/** Single "size" used for category "Autre" (no size breakdown, one quantity) */
const OTHER_CATEGORY_SIZE = "Unique";
const allSizes = [...clothingSizes, ...shoeSizes, OTHER_CATEGORY_SIZE];

/** Sentinel for "no color" – Radix Select disallows value="" on SelectItem */
const COLOR_NONE = "__none__";

const productFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  mainCategory: z.string().min(1, "La catégorie principale est requise"),
  category: z.string().min(1, "La catégorie est requise"),
  color: z.string().optional(),
  defaultPrice: z.string().min(1, "Le prix est requis"),
  imageUrl: z.string().optional(),
  isPublished: z.boolean().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

type ProductCategory = { id: string; slug: string; name: string };
type MainCategory = { id: string; slug: string; label: string; position: number; imageUrl?: string | null };

function getCategoryLabel(slug: string, categories?: ProductCategory[]) {
  const cat = categories?.find((c) => c.slug === slug);
  return cat?.name ?? slug;
}

export default function Stock() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithVariants | null>(null);
  const [detailProduct, setDetailProduct] = useState<ProductWithVariants | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductWithVariants | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedColor, setSelectedColor] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDialogType, setCategoryDialogType] = useState<"product" | "main">("product");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [newMainCategoryImageUrl, setNewMainCategoryImageUrl] = useState<string | null>(null);
  const mainCategoryUploadRef = useRef<HTMLInputElement>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingMainCategory, setEditingMainCategory] = useState<MainCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
  const [mainCategoryToDelete, setMainCategoryToDelete] = useState<MainCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategorySlug, setEditCategorySlug] = useState("");
  const [editMainLabel, setEditMainLabel] = useState("");
  const [editMainSlug, setEditMainSlug] = useState("");
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});
  const MAX_PRODUCT_IMAGES = 6;
  const [uploadedImagePaths, setUploadedImagePaths] = useState<(string | null)[]>(() => Array(MAX_PRODUCT_IMAGES).fill(null));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingSlotRef = useRef<number | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger l'image",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      mainCategory: "homme",
      category: "vetement",
      color: "",
      defaultPrice: "",
      imageUrl: "",
      isPublished: true, // visible on storefront by default
    },
  });

  const category = form.watch("category");

  const { data: products, isLoading } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories = [], refetch: refetchCategories } = useQuery<ProductCategory[]>({
    queryKey: ["/api/categories"],
  });

  const { data: mainCategoriesList = [], refetch: refetchMainCategories } = useQuery<MainCategory[]>({
    queryKey: ["/api/main-categories"],
  });

  const createMainCategoryMutation = useMutation({
    mutationFn: async (data: { label: string; slug?: string; position?: number; imageUrl?: string | null }) => {
      const res = await fetch("/api/main-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchMainCategories();
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategorySlug("");
      setNewMainCategoryImageUrl(null);
      toast({ title: "Catégorie principale ajoutée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCategories();
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategorySlug("");
      setNewMainCategoryImageUrl(null);
      toast({
        title: "Catégorie créée",
        description: "La catégorie a été ajoutée avec succès",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name, slug }: { id: string; name?: string; slug?: string }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCategories();
      setEditingCategory(null);
      toast({ title: "Catégorie mise à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Impossible de supprimer");
      }
    },
    onSuccess: () => {
      refetchCategories();
      setCategoryToDelete(null);
      toast({ title: "Catégorie supprimée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateMainCategoryMutation = useMutation({
    mutationFn: async ({ id, label, slug }: { id: string; label?: string; slug?: string }) => {
      const res = await fetch(`/api/main-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, slug }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchMainCategories();
      setEditingMainCategory(null);
      toast({ title: "Catégorie principale mise à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMainCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/main-categories/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Impossible de supprimer");
      }
    },
    onSuccess: () => {
      refetchMainCategories();
      setMainCategoryToDelete(null);
      toast({
        title: "Catégorie principale supprimée",
        description: "Elle ne sera plus affichée sur la boutique (même base de données).",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const nameOrLabel = newCategoryName.trim();
    if (!nameOrLabel) return;
    const slug = newCategorySlug.trim() || nameOrLabel.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (categoryDialogType === "main") {
      createMainCategoryMutation.mutate({
        label: nameOrLabel,
        slug: slug || undefined,
        position: mainCategoriesList.length,
        imageUrl: newMainCategoryImageUrl || undefined,
      });
    } else {
      createCategoryMutation.mutate({ name: nameOrLabel, slug });
    }
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues & { variants: Array<{ size: string; quantity: number }> }) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsDialogOpen(false);
      form.reset();
      setVariantQuantities({});
      setUploadedImagePaths(Array(MAX_PRODUCT_IMAGES).fill(null));
      toast({
        title: "Produit ajouté",
        description: "Le produit a été ajouté avec succès",
      });
    },
    onError: (err: Error) => {
      let description = "Impossible d'ajouter le produit";
      const colonIdx = err.message.indexOf(":");
      if (colonIdx !== -1) {
        const rest = err.message.slice(colonIdx + 1).trim();
        try {
          const body = JSON.parse(rest) as { error?: string; details?: string };
          if (body.details) description = body.details;
          else if (body.error) description = body.error;
        } catch {
          if (rest) description = rest;
        }
      } else if (err.message) {
        description = err.message;
      }
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ variantId, quantity, type }: { variantId: string; quantity: number; type: "in" | "out" }) => {
      return apiRequest("POST", `/api/variants/${variantId}/stock`, { quantity, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; mainCategory: string; category: string; color?: string; defaultPrice: string; imageUrl?: string; isPublished?: boolean; imageUrls?: string[] }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setEditingProduct(null);
      form.reset();
      setUploadedImagePaths(Array(MAX_PRODUCT_IMAGES).fill(null));
      toast({
        title: "Produit modifié",
        description: "Le produit a été mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le produit",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setProductToDelete(null);
      toast({
        title: "Produit supprimé",
        description: "Le produit a été supprimé",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = uploadingSlotRef.current;
    if (slot === null || slot === undefined) return;
    const res = await uploadFile(file);
    if (res?.objectPath) {
      setUploadedImagePaths((prev) => {
        const next = [...prev];
        next[slot] = res.objectPath;
        return next;
      });
      toast({ title: "Image ajoutée", description: "L'image a été téléchargée." });
    }
    uploadingSlotRef.current = null;
    e.target.value = "";
  };

  const triggerUpload = (slotIndex: number) => {
    uploadingSlotRef.current = slotIndex;
    fileInputRef.current?.click();
  };

  const clearImageAt = (slotIndex: number) => {
    setUploadedImagePaths((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  const onSubmit = (data: ProductFormValues) => {
    const sizes = data.category === "vetement" ? clothingSizes
      : data.category === "chaussures" ? shoeSizes
      : data.category === "autre" ? [OTHER_CATEGORY_SIZE]
      : [];

    const variants = sizes.map((size) => ({
      size,
      quantity: variantQuantities[size] ?? 0,
    }));

    const imageUrls = uploadedImagePaths.filter((url): url is string => Boolean(url));

    createProductMutation.mutate({
      ...data,
      mainCategory: data.mainCategory,
      defaultPrice: String(Number(data.defaultPrice) || 0),
      color: data.color || undefined,
      imageUrl: imageUrls[0] ?? undefined,
      isPublished: data.isPublished ?? true,
      variants,
      imageUrls,
    });
  };

  useEffect(() => {
    if (editingProduct) {
      const category = editingProduct.category as "vetement" | "chaussures" | "autre";
      const mainCat = (editingProduct as { mainCategory?: string }).mainCategory ?? "homme";
      form.reset({
        name: editingProduct.name,
        mainCategory: mainCat,
        category,
        color: (editingProduct as { color?: string | null }).color ?? "",
        defaultPrice: String(Number(editingProduct.defaultPrice)),
        imageUrl: editingProduct.imageUrl || "",
        isPublished: (editingProduct as { isPublished?: boolean }).isPublished ?? false,
      });
      const images = (editingProduct as { images?: { imageUrl: string; position: number }[] }).images ?? [];
      const paths = Array(MAX_PRODUCT_IMAGES).fill(null) as (string | null)[];
      images
        .sort((a, b) => a.position - b.position)
        .forEach((img, i) => {
          if (i < MAX_PRODUCT_IMAGES) paths[i] = img.imageUrl;
        });
      if (paths.every((p) => !p) && editingProduct.imageUrl) paths[0] = editingProduct.imageUrl;
      setUploadedImagePaths(paths);
    }
  }, [editingProduct]);

  const onEditSubmit = (data: ProductFormValues) => {
    if (!editingProduct) return;
    const imageUrls = uploadedImagePaths.filter((url): url is string => Boolean(url));
    updateProductMutation.mutate({
      id: editingProduct.id,
      name: data.name,
      mainCategory: data.mainCategory,
      category: data.category,
      color: data.color || undefined,
      defaultPrice: String(Number(data.defaultPrice) || 0),
      imageUrl: imageUrls[0],
      isPublished: data.isPublished,
      imageUrls,
    });
  };

  const filteredProducts = products?.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesColor =
      selectedColor === "all" ||
      (product.color != null && product.color !== "" && product.color === selectedColor);
    const matchesSize =
      selectedSize === "all" || product.variants.some((v) => v.size === selectedSize);
    return matchesSearch && matchesCategory && matchesColor && matchesSize;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner
        breadcrumb="Backoffice"
        title="Catalogue produits"
        subtitle="Gérez vos produits et votre inventaire"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-upload"
        aria-hidden
      />
      {/* Sticky search + actions bar */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-3 pt-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 w-full min-w-0 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher un produit..."
              className="pl-10 min-h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-product"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-10 gap-2"
              onClick={() => setManageCategoriesOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              Gérer les catégories
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10 gap-2"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <FolderPlus className="h-4 w-4" />
              Nouvelle catégorie
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setUploadedImagePaths(Array(MAX_PRODUCT_IMAGES).fill(null));
                form.reset();
                setVariantQuantities({});
              }
            }}>
              <DialogTrigger asChild>
                <Button className="min-h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-product">
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouveau produit</DialogTitle>
                <DialogDescription>Ajoutez un nouveau produit à votre inventaire</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du produit</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: T-shirt Nike" {...field} data-testid="input-product-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mainCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie principale <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-main-category">
                              <SelectValue placeholder="Homme / Femme / Enfant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mainCategoriesList.map((mc) => (
                              <SelectItem key={mc.id} value={mc.slug}>{mc.label}</SelectItem>
                            ))}
                            {mainCategoriesList.length === 0 && (
                              <>
                                <SelectItem value="homme">Homme</SelectItem>
                                <SelectItem value="femme">Femme</SelectItem>
                                <SelectItem value="enfant">Enfant</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catégorie</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Couleur</FormLabel>
                          <Select
                            value={field.value && field.value !== "" ? field.value : COLOR_NONE}
                            onValueChange={(v) => field.onChange(v === COLOR_NONE ? "" : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Optionnel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={COLOR_NONE}>Aucune</SelectItem>
                              {productColorOptions.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="defaultPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix (€)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isPublished"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Publié sur le storefront</FormLabel>
                            <p className="text-xs text-muted-foreground">Visible sur la boutique publique</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Image Upload Section – up to 6 images */}
                  <div className="space-y-3">
                    <Label>Images du produit (max. 6)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {Array.from({ length: MAX_PRODUCT_IMAGES }, (_, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted border">
                          {uploadedImagePaths[i] ? (
                            <div className="relative h-full w-full group">
                              <img
                                src={uploadedImagePaths[i]!}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 h-7 w-7 opacity-90 group-hover:opacity-100"
                                onClick={() => clearImageAt(i)}
                                data-testid={`button-clear-image-${i}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/80 transition-colors border-0 cursor-pointer"
                              onClick={() => triggerUpload(i)}
                              disabled={isUploading}
                              data-testid={`dropzone-image-${i}`}
                            >
                              {isUploading && uploadingSlotRef.current === i ? (
                                <Loader2 className="h-8 w-8 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="h-8 w-8" />
                                  <span className="text-xs">Ajouter</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vous pouvez ajouter jusqu’à 6 images. La première sera utilisée comme image principale.
                    </p>
                  </div>

                  {category === "autre" && (
                    <div className="space-y-3">
                      <Label htmlFor="qty-autre">Quantité (stock)</Label>
                      <Input
                        id="qty-autre"
                        type="number"
                        min="0"
                        className="max-w-[120px]"
                        value={variantQuantities[OTHER_CATEGORY_SIZE] ?? ""}
                        onChange={(e) =>
                          setVariantQuantities((prev) => ({
                            ...prev,
                            [OTHER_CATEGORY_SIZE]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        placeholder="0"
                        data-testid="input-qty-autre"
                      />
                      <p className="text-xs text-muted-foreground">
                        Quantité en stock pour les produits sans taille (catégorie Autre).
                      </p>
                    </div>
                  )}
                  {category !== "autre" && (category === "vetement" || category === "chaussures") && (
                    <div className="space-y-3">
                      <Label>Quantités par taille</Label>
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-border/70 bg-muted/10 p-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {(category === "vetement" ? clothingSizes : shoeSizes).map((size) => (
                            <div key={size} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                              <Label className="text-sm text-muted-foreground">Taille {size}</Label>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 w-20 text-center"
                                value={variantQuantities[size] || ""}
                                onChange={(e) => setVariantQuantities(prev => ({
                                  ...prev,
                                  [size]: parseInt(e.target.value) || 0
                                }))}
                                data-testid={`input-qty-${size}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={createProductMutation.isPending || isUploading} data-testid="button-submit-product">
                      {createProductMutation.isPending ? "Ajout..." : "Ajouter le produit"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Nouvelle catégorie (produit ou principale) */}
          <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
            setCategoryDialogOpen(open);
            if (!open) {
              setNewCategoryName("");
              setNewCategorySlug("");
              setNewMainCategoryImageUrl(null);
            }
          }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Nouvelle catégorie</DialogTitle>
                <DialogDescription>
                  Catégorie produit (ex. Vêtements, Chaussures) ou catégorie principale (ex. Homme, Femme, Enfant) affichée sur la boutique.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={categoryDialogType === "product" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCategoryDialogType("product")}
                    >
                      Catégorie produit
                    </Button>
                    <Button
                      type="button"
                      variant={categoryDialogType === "main" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCategoryDialogType("main")}
                    >
                      Catégorie principale
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {categoryDialogType === "product"
                      ? "Ex. Vêtements, Chaussures, Accessoires"
                      : "Ex. Homme, Femme, Enfant — affichée en grand sur la boutique"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-name">{categoryDialogType === "main" ? "Libellé" : "Nom"}</Label>
                  <Input
                    id="cat-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={categoryDialogType === "main" ? "Ex: Homme" : "Ex: Accessoires"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-slug" className="text-muted-foreground text-xs">Slug (optionnel, généré automatiquement si vide)</Label>
                  <Input
                    id="cat-slug"
                    value={newCategorySlug}
                    onChange={(e) => setNewCategorySlug(e.target.value)}
                    placeholder="Ex: homme, accessoires"
                  />
                </div>
                {categoryDialogType === "main" && (
                  <div className="space-y-2">
                    <Label>Image (optionnel)</Label>
                    <input
                      ref={mainCategoryUploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const res = await uploadFile(file);
                        if (res?.objectPath) {
                          setNewMainCategoryImageUrl(res.objectPath);
                          toast({ title: "Image ajoutée" });
                        }
                        e.target.value = "";
                      }}
                    />
                    {newMainCategoryImageUrl ? (
                      <div className="flex items-center gap-2 rounded-lg border p-2">
                        <img src={newMainCategoryImageUrl} alt="" className="h-14 w-14 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">Image de la catégorie</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setNewMainCategoryImageUrl(null)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => mainCategoryUploadRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4" />
                        {isUploading ? "Téléchargement..." : "Choisir une image"}
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      categoryDialogType === "product"
                        ? createCategoryMutation.isPending
                        : createMainCategoryMutation.isPending
                    }
                  >
                    {categoryDialogType === "product"
                      ? (createCategoryMutation.isPending ? "Création..." : "Créer")
                      : (createMainCategoryMutation.isPending ? "Création..." : "Créer")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Gérer les catégories */}
          <Dialog
            open={manageCategoriesOpen}
            onOpenChange={(open) => {
              setManageCategoriesOpen(open);
              if (!open) {
                setEditingCategory(null);
                setEditingMainCategory(null);
                setCategoryToDelete(null);
                setMainCategoryToDelete(null);
              }
            }}
          >
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Gérer les catégories</DialogTitle>
                <DialogDescription>
                  Modifier ou supprimer les catégories produit et les catégories principales. Les catégories utilisées par des produits ne peuvent pas être supprimées.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Catégories produit</h4>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/40">
                    {categories.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Aucune catégorie produit.</p>
                    ) : (
                      categories.map((cat) => (
                        <div key={cat.id} className="p-3 flex flex-wrap items-center gap-2">
                          {editingCategory?.id === cat.id ? (
                            <>
                              <Input
                                className="flex-1 min-w-[100px] h-8"
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                                placeholder="Nom"
                              />
                              <Input
                                className="flex-1 min-w-[80px] h-8"
                                value={editCategorySlug}
                                onChange={(e) => setEditCategorySlug(e.target.value)}
                                placeholder="Slug"
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                  updateCategoryMutation.mutate({
                                    id: cat.id,
                                    name: editCategoryName.trim() || undefined,
                                    slug: editCategorySlug.trim() || undefined,
                                  });
                                }}
                                disabled={updateCategoryMutation.isPending || !editCategoryName.trim()}
                              >
                                Enregistrer
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingCategory(null)}>
                                Annuler
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="font-medium flex-1 min-w-0 truncate">{cat.name}</span>
                              <span className="text-muted-foreground text-sm">{cat.slug}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setEditCategoryName(cat.name);
                                  setEditCategorySlug(cat.slug);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => setCategoryToDelete(cat)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Catégories principales</h4>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/40">
                    {mainCategoriesList.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Aucune catégorie principale.</p>
                    ) : (
                      mainCategoriesList.map((mc) => (
                        <div key={mc.id} className="p-3 flex flex-wrap items-center gap-2">
                          {editingMainCategory?.id === mc.id ? (
                            <>
                              <Input
                                className="flex-1 min-w-[100px] h-8"
                                value={editMainLabel}
                                onChange={(e) => setEditMainLabel(e.target.value)}
                                placeholder="Libellé"
                              />
                              <Input
                                className="flex-1 min-w-[80px] h-8"
                                value={editMainSlug}
                                onChange={(e) => setEditMainSlug(e.target.value)}
                                placeholder="Slug"
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                  updateMainCategoryMutation.mutate({
                                    id: mc.id,
                                    label: editMainLabel.trim() || undefined,
                                    slug: editMainSlug.trim() || undefined,
                                  });
                                }}
                                disabled={updateMainCategoryMutation.isPending || !editMainLabel.trim()}
                              >
                                Enregistrer
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingMainCategory(null)}>
                                Annuler
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="font-medium flex-1 min-w-0 truncate">{mc.label}</span>
                              <span className="text-muted-foreground text-sm">{mc.slug}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  setEditingMainCategory(mc);
                                  setEditMainLabel(mc.label);
                                  setEditMainSlug(mc.slug);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => setMainCategoryToDelete(mc)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Confirm delete category */}
          <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {categoryToDelete
                    ? `« ${categoryToDelete.name} » sera supprimée. Impossible si des produits utilisent cette catégorie.`
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => categoryToDelete && deleteCategoryMutation.mutate(categoryToDelete.id)}
                  disabled={deleteCategoryMutation.isPending}
                >
                  {deleteCategoryMutation.isPending ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={!!mainCategoryToDelete} onOpenChange={(open) => !open && setMainCategoryToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette catégorie principale ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {mainCategoryToDelete
                    ? `« ${mainCategoryToDelete.label} » sera supprimée et n'apparaîtra plus sur la boutique. Impossible si des produits l'utilisent.`
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => mainCategoryToDelete && deleteMainCategoryMutation.mutate(mainCategoryToDelete.id)}
                  disabled={deleteMainCategoryMutation.isPending}
                >
                  {deleteMainCategoryMutation.isPending ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>
      </div>

      {/* Content: sidebar filters + main grid */}
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-56 shrink-0 space-y-4 p-4 rounded-xl border border-gold/20 bg-card h-fit">
          <div>
            <Label className="text-sm font-medium mb-2 block">Catégorie</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory} data-testid="select-filter-category">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Couleur</Label>
            <Select value={selectedColor} onValueChange={setSelectedColor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Couleur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {productColorOptions.map((color) => (
                  <SelectItem key={color} value={color}>{color}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Taille</Label>
            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Taille" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {allSizes.map((size) => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Edit product dialog */}
          <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Modifier le produit</DialogTitle>
                <DialogDescription>Modifiez les informations du produit</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du produit</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: T-shirt Nike" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mainCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie principale <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Homme / Femme / Enfant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mainCategoriesList.map((mc) => (
                              <SelectItem key={mc.id} value={mc.slug}>{mc.label}</SelectItem>
                            ))}
                            {mainCategoriesList.length === 0 && (
                              <>
                                <SelectItem value="homme">Homme</SelectItem>
                                <SelectItem value="femme">Femme</SelectItem>
                                <SelectItem value="enfant">Enfant</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catégorie</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Couleur</FormLabel>
                          <Select
                            value={field.value && field.value !== "" ? field.value : COLOR_NONE}
                            onValueChange={(v) => field.onChange(v === COLOR_NONE ? "" : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Optionnel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={COLOR_NONE}>Aucune</SelectItem>
                              {productColorOptions.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="defaultPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix (€)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isPublished"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Publié sur le storefront</FormLabel>
                            <p className="text-xs text-muted-foreground">Visible sur la boutique publique</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Images du produit (max. 6)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {Array.from({ length: MAX_PRODUCT_IMAGES }, (_, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted border">
                          {uploadedImagePaths[i] ? (
                            <div className="relative h-full w-full group">
                              <img src={uploadedImagePaths[i]!} alt="" className="h-full w-full object-cover" />
                              <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-7 w-7 opacity-90 group-hover:opacity-100" onClick={() => clearImageAt(i)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <button type="button" className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/80 transition-colors border-0 cursor-pointer" onClick={() => triggerUpload(i)} disabled={isUploading}>
                              {isUploading && uploadingSlotRef.current === i ? <Loader2 className="h-8 w-8 animate-spin" /> : (<><Upload className="h-8 w-8" /><span className="text-xs">Ajouter</span></>)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>Annuler</Button>
                    <Button type="submit" disabled={updateProductMutation.isPending || isUploading}>
                      {updateProductMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Product detail popup (read-only) */}
          <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
            <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
              {detailProduct && (
                <>
                  <DialogHeader className="sr-only">
                    <DialogTitle>Détails du produit : {detailProduct.name}</DialogTitle>
                  </DialogHeader>
                  {/* Hero-style image */}
                  <div className="relative w-full aspect-[4/3] bg-muted">
                    {detailProduct.imageUrl ? (
                      <img
                        src={detailProduct.imageUrl}
                        alt={detailProduct.name}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-20 w-20 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  {/* Name + details */}
                  <div className="p-5 space-y-4">
                    <h2 className="text-xl font-semibold leading-tight">{detailProduct.name}</h2>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Catégorie principale</dt>
                        <dd className="font-medium">{mainCategoriesList.find((mc) => mc.slug === (detailProduct as { mainCategory?: string }).mainCategory)?.label ?? (detailProduct as { mainCategory?: string }).mainCategory}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Catégorie</dt>
                        <dd className="font-medium">{getCategoryLabel(detailProduct.category, categories)}</dd>
                      </div>
                      {(detailProduct as { color?: string | null }).color && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Couleur</dt>
                          <dd className="font-medium">{(detailProduct as { color?: string | null }).color}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Prix</dt>
                        <dd className="font-medium">{Number(detailProduct.defaultPrice).toFixed(2)} €</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Stock total</dt>
                        <dd className="font-medium">{detailProduct.totalStock} unités</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground mb-1">Tailles et quantités</dt>
                        <dd className="flex flex-wrap gap-2">
                          {detailProduct.variants.map((v) => (
                            <Badge key={v.id} variant="secondary" className="font-normal">
                              {v.size} : {v.quantity}
                            </Badge>
                          ))}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex justify-end pt-2">
                      <Button variant="outline" size="sm" onClick={() => { setDetailProduct(null); setEditingProduct(detailProduct); }}>
                        Modifier
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete product confirmation */}
          <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Le produit et ses variantes seront supprimés définitivement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => productToDelete && deleteProductMutation.mutate(productToDelete.id)}
                  disabled={deleteProductMutation.isPending}
                >
                  {deleteProductMutation.isPending ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <>
            {filteredProducts && filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden flex flex-col" data-testid={`card-product-${product.id}`}>
                  {/* Figure: product image */}
                  <div className="relative aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-neutral-300 dark:text-neutral-600" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs">
                        {product.totalStock} en stock
                      </Badge>
                      <Badge className="bg-background/90 backdrop-blur-sm text-foreground text-xs">
                        {getCategoryLabel(product.category, categories)}
                      </Badge>
                    </div>
                    <div className="absolute top-2 left-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8 shrink-0 bg-background/90 backdrop-blur-sm" data-testid={`menu-product-${product.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => setEditingProduct(product)} data-testid={`edit-product-${product.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setProductToDelete(product)}
                            data-testid={`delete-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {/* Body: title + price + stock + details */}
                  <CardContent className="flex flex-1 flex-col p-4">
                    <h3 className="font-display font-medium text-base leading-tight">{product.name}</h3>
                    <div className="mt-2 flex-1 flex items-baseline justify-between gap-2">
                      <span className="text-lg font-semibold text-primary">
                        {Number(product.defaultPrice).toFixed(2)} €
                      </span>
                      <span className="text-xs text-muted-foreground">{product.totalStock} en stock</span>
                    </div>
                    <div className="mt-3 h-px w-8 bg-gold/40" />
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailProduct(product)}
                        data-testid={`details-product-${product.id}`}
                        className="text-xs tracking-wide hover:border-primary hover:text-primary"
                      >
                        Détails
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun produit</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  {searchQuery ? "Aucun produit ne correspond à votre recherche" : "Commencez par ajouter votre premier produit"}
                </p>
                <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-product">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un produit
                </Button>
              </CardContent>
            </Card>
          )}
          </>
        </div>
      </div>
    </div>
  );
}
