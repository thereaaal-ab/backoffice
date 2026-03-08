import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Minus, 
  ShoppingCart, 
  X, 
  ImageIcon, 
  Check, 
  Clock, 
  AlertCircle,
  Search,
  CreditCard,
  Trash2
} from "lucide-react";
import { PageBanner } from "@/components/page-banner";
import type { SaleWithDetails, ProductWithVariants } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
  maxQuantity: number;
}

type PaymentStatus = "paid" | "unpaid" | "partial";

const categoryLabels: Record<string, string> = {
  vetement: "Vêtements",
  chaussures: "Chaussures",
  autre: "Autres",
};

export default function Sales() {
  const { toast } = useToast();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [paidAmount, setPaidAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [paymentDialogSale, setPaymentDialogSale] = useState<SaleWithDetails | null>(null);
  const [followUpAmount, setFollowUpAmount] = useState("");
  const [saleToDelete, setSaleToDelete] = useState<SaleWithDetails | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/products"],
  });

  const { data: sales, isLoading: salesLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales"],
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data: { 
      customerName?: string; 
      items: Array<{ variantId: string; quantity: number; unitPrice: number }>;
      paymentStatus: PaymentStatus;
      paidAmount?: number;
    }) => {
      return apiRequest("POST", "/api/sales", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCart([]);
      setCustomerName("");
      setPaymentStatus("paid");
      setPaidAmount("");
      setIsCartOpen(false);
      toast({
        title: "Vente enregistrée",
        description: "La vente a été enregistrée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la vente",
        variant: "destructive",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ saleId, amount }: { saleId: string; amount: number }) => {
      return apiRequest("PATCH", `/api/sales/${saleId}/payment`, { additionalAmount: amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setPaymentDialogSale(null);
      setFollowUpAmount("");
      toast({
        title: "Paiement enregistré",
        description: "Le paiement a été ajouté avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le paiement",
        variant: "destructive",
      });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/sales/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setSaleToDelete(null);
      toast({ title: "Vente supprimée", description: "La vente a été supprimée" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la vente",
        variant: "destructive",
      });
    },
  });

  const addToCart = (product: ProductWithVariants, variantId: string, size: string, maxQty: number) => {
    const existingIndex = cart.findIndex(item => item.variantId === variantId);
    
    if (existingIndex >= 0) {
      const updated = [...cart];
      if (updated[existingIndex].quantity < maxQty) {
        updated[existingIndex].quantity += 1;
        setCart(updated);
      }
    } else {
      setCart([...cart, {
        variantId,
        productId: product.id,
        productName: product.name,
        size,
        quantity: 1,
        unitPrice: Number(product.defaultPrice),
        imageUrl: product.imageUrl,
        maxQuantity: maxQty,
      }]);
    }
  };

  const updateCartQuantity = (variantId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(variantId);
      return;
    }
    
    setCart(cart.map(item => 
      item.variantId === variantId 
        ? { ...item, quantity: Math.min(newQuantity, item.maxQuantity) }
        : item
    ));
  };

  const removeFromCart = (variantId: string) => {
    setCart(cart.filter(item => item.variantId !== variantId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const confirmSale = () => {
    if (cart.length === 0) {
      toast({ title: "Panier vide", description: "Ajoutez des articles au panier", variant: "destructive" });
      return;
    }

    const paidAmountNum = paymentStatus === "partial" ? parseFloat(paidAmount) || 0 : 
                          paymentStatus === "paid" ? cartTotal : 0;

    if (paymentStatus === "partial" && (paidAmountNum <= 0 || paidAmountNum >= cartTotal)) {
      toast({ title: "Montant invalide", description: "Le montant payé doit être entre 0 et le total", variant: "destructive" });
      return;
    }

    createSaleMutation.mutate({
      customerName: customerName.trim() || undefined,
      items: cart.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      paymentStatus,
      paidAmount: paymentStatus === "partial" ? paidAmountNum : undefined,
    });
  };

  const handleFollowUpPayment = () => {
    if (!paymentDialogSale) return;
    const amount = parseFloat(followUpAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Montant invalide", description: "Entrez un montant valide", variant: "destructive" });
      return;
    }
    if (amount > paymentDialogSale.remainingAmount) {
      toast({ title: "Montant trop élevé", description: `Le montant ne peut pas dépasser ${paymentDialogSale.remainingAmount.toFixed(0)}€`, variant: "destructive" });
      return;
    }
    updatePaymentMutation.mutate({ saleId: paymentDialogSale.id, amount });
  };

  const payFullRemaining = () => {
    if (!paymentDialogSale) return;
    updatePaymentMutation.mutate({ saleId: paymentDialogSale.id, amount: paymentDialogSale.remainingAmount });
  };

  // Group products by category
  const productsByCategory = products?.reduce((acc, product) => {
    const cat = product.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, ProductWithVariants[]>) || {};

  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.totalStock > 0;
  });

  const getPaymentStatusBadge = (status: string, remaining: number) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><Check className="h-3 w-3 mr-1" />Payé</Badge>;
      case "unpaid":
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><AlertCircle className="h-3 w-3 mr-1" />À payer</Badge>;
      case "partial":
        return <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"><Clock className="h-3 w-3 mr-1" />Reste {remaining.toFixed(0)}€</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  // Check if product was added recently (within last 7 days)
  const isNewProduct = (createdAt: Date) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(createdAt) > sevenDaysAgo;
  };

  if (productsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
    <div className="space-y-4 sm:space-y-6">
      <PageBanner
        breadcrumb="Backoffice"
        title="Ventes"
        subtitle="Enregistrez une vente ou consultez l'historique"
      />
      {/* Header with cart button and toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant={!showHistory ? "default" : "outline"}
            size="sm"
            className="min-h-10 touch-manipulation"
            onClick={() => setShowHistory(false)}
            data-testid="button-show-products"
          >
            Nouvelle vente
          </Button>
          <Button
            variant={showHistory ? "default" : "outline"}
            size="sm"
            className="min-h-10 touch-manipulation"
            onClick={() => setShowHistory(true)}
            data-testid="button-show-history"
          >
            Historique
          </Button>
        </div>
        
        {!showHistory && (
          <>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-product"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40" data-testid="select-category-filter">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout</SelectItem>
                <SelectItem value="vetement">Vêtements</SelectItem>
                <SelectItem value="chaussures">Chaussures</SelectItem>
                <SelectItem value="autre">Autres</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        
        {!showHistory && cart.length > 0 && (
          <Button onClick={() => setIsCartOpen(true)} className="relative" data-testid="button-open-cart">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Panier
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {cartItemCount}
            </Badge>
          </Button>
        )}
      </div>

      {!showHistory ? (
        // Product Grid View - Inspired by reference image
        <>
          {filteredProducts && filteredProducts.length > 0 ? (
            <div className="space-y-10">
              {Object.entries(productsByCategory)
                .filter(([cat]) => selectedCategory === "all" || cat === selectedCategory)
                .map(([category, categoryProducts]) => {
                  const visibleProducts = categoryProducts.filter(p => 
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) && p.totalStock > 0
                  );
                  if (visibleProducts.length === 0) return null;
                  
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-4 mb-6">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">{categoryLabels[category] || category}</p>
                        <div className="flex-1 h-px bg-gold/30" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {visibleProducts.map((product) => (
                          <Card key={product.id} className="overflow-hidden flex flex-col" data-testid={`card-product-${product.id}`}>
                            {/* Figure: product image (daisyUI-style) */}
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
                                {product.totalStock <= 3 && (
                                  <Badge variant="secondary" className="bg-amber-500/90 text-amber-950 text-xs backdrop-blur-sm">
                                    {product.totalStock === 1 ? "Dernier" : `${product.totalStock} restants`}
                                  </Badge>
                                )}
                                {isNewProduct(product.createdAt) && (
                                  <Badge className="bg-background/90 backdrop-blur-sm text-foreground text-xs">
                                    NEW
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {/* Body: name, price · stock, size buttons */}
                            <CardContent className="flex flex-1 flex-col p-4">
                              <h3 className="font-display font-medium text-base leading-tight">{product.name}</h3>
                              <div className="flex items-baseline gap-2 mt-2 flex-1">
                                <span className="text-lg font-semibold text-primary">{Number(product.defaultPrice).toFixed(2)} €</span>
                                <span className="text-xs text-muted-foreground">{product.totalStock} en stock</span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-4 pt-2">
                                {product.variants.map((variant) => {
                                  const inCart = cart.find(c => c.variantId === variant.id);
                                  const availableQty = variant.quantity - (inCart?.quantity || 0);
                                  const isOutOfStock = variant.quantity === 0;
                                  const isInCartFull = availableQty <= 0;
                                  return (
                                    <Button
                                      key={variant.id}
                                      variant={isOutOfStock ? "ghost" : inCart || isInCartFull ? "default" : "outline"}
                                      size="sm"
                                      className="min-w-[36px] shrink-0"
                                      onClick={() => !isOutOfStock && !isInCartFull && addToCart(product, variant.id, variant.size, variant.quantity)}
                                      disabled={isOutOfStock || isInCartFull}
                                      data-testid={`button-add-${variant.id}`}
                                    >
                                      {variant.size}
                                      {inCart && !isInCartFull && <span className="ml-0.5">+</span>}
                                    </Button>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun produit disponible</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  {searchQuery ? "Aucun produit ne correspond à votre recherche" : "Ajoutez des produits en stock pour commencer"}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        // Sales History View
        <div className="space-y-3">
          {salesLoading ? (
            [...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          ) : sales && sales.length > 0 ? (
            sales.map((sale) => (
              <Card key={sale.id} data-testid={`row-sale-${sale.id}`}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                      sale.paymentStatus === "paid" 
                        ? "bg-green-100 dark:bg-green-900/30" 
                        : sale.paymentStatus === "partial"
                          ? "bg-amber-100 dark:bg-amber-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                    }`}>
                      <ShoppingCart className={`h-5 w-5 ${
                        sale.paymentStatus === "paid" 
                          ? "text-green-600 dark:text-green-400" 
                          : sale.paymentStatus === "partial"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">
                        {sale.client?.name || sale.customerName || "Anonyme"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.createdAt), "d MMM yyyy, HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                    {getPaymentStatusBadge(sale.paymentStatus, sale.remainingAmount)}
                    <p className="font-bold text-lg min-w-[70px] text-right text-primary">
                      {Number(sale.totalAmount).toFixed(0)}€
                    </p>
                    {sale.paymentStatus !== "paid" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setPaymentDialogSale(sale);
                          setFollowUpAmount("");
                        }}
                        data-testid={`button-pay-${sale.id}`}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Payer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setSaleToDelete(sale)}
                      data-testid={`button-delete-sale-${sale.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune vente</h3>
                <p className="text-muted-foreground text-center">Enregistrez votre première vente</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Panier ({cartItemCount} articles)</DialogTitle>
            <DialogDescription>Vérifiez votre commande et finalisez la vente</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Cart Items */}
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.variantId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  data-testid={`cart-item-${item.variantId}`}
                >
                  <div className="h-12 w-12 rounded-md bg-background overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">Taille {item.size} • {item.unitPrice}€</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                      data-testid={`button-decrease-${item.variantId}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxQuantity}
                      data-testid={`button-increase-${item.variantId}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFromCart(item.variantId)}
                      data-testid={`button-remove-${item.variantId}`}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center py-3 border-t border-b border-gold/20">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
              <span className="text-2xl font-display font-medium text-primary">{cartTotal.toFixed(0)} €</span>
            </div>

            {/* Customer Name */}
            <div>
              <Label htmlFor="customerName" className="text-sm font-medium">Nom du client</Label>
              <Input
                id="customerName"
                placeholder="Optionnel"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1"
                data-testid="input-customer-name"
              />
            </div>

            {/* Payment Status */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Statut de paiement</Label>
              <RadioGroup
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer" onClick={() => setPaymentStatus("paid")}>
                  <RadioGroupItem value="paid" id="paid" data-testid="radio-paid" />
                  <Label htmlFor="paid" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Payé intégralement</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer" onClick={() => setPaymentStatus("unpaid")}>
                  <RadioGroupItem value="unpaid" id="unpaid" data-testid="radio-unpaid" />
                  <Label htmlFor="unpaid" className="flex items-center gap-2 cursor-pointer flex-1">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span>À payer plus tard</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer" onClick={() => setPaymentStatus("partial")}>
                  <RadioGroupItem value="partial" id="partial" data-testid="radio-partial" />
                  <Label htmlFor="partial" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>Paiement partiel</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Partial Payment Amount */}
            {paymentStatus === "partial" && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 space-y-3">
                <div>
                  <Label htmlFor="paidAmount" className="text-sm font-medium">Montant payé</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="paidAmount"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      data-testid="input-paid-amount"
                    />
                    <span className="text-lg font-medium">€</span>
                  </div>
                </div>
                {paidAmount && parseFloat(paidAmount) > 0 && (
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Reste à payer : {(cartTotal - parseFloat(paidAmount)).toFixed(0)}€
                  </p>
                )}
              </div>
            )}

            {/* Confirm Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={confirmSale}
              disabled={cart.length === 0 || createSaleMutation.isPending}
              data-testid="button-confirm-sale"
            >
              {createSaleMutation.isPending ? "Enregistrement..." : "Confirmer la vente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Follow-up Dialog */}
      <Dialog open={!!paymentDialogSale} onOpenChange={(open) => !open && setPaymentDialogSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
            <DialogDescription>
              Ajoutez un paiement pour la vente de {paymentDialogSale?.client?.name || paymentDialogSale?.customerName || "Anonyme"}
            </DialogDescription>
          </DialogHeader>
          
          {paymentDialogSale && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total de la vente</span>
                  <span className="font-medium">{Number(paymentDialogSale.totalAmount).toFixed(0)}€</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Déjà payé</span>
                  <span className="font-medium">{Number(paymentDialogSale.paidAmount).toFixed(0)}€</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Reste à payer</span>
                  <span className="text-amber-600 dark:text-amber-400">{paymentDialogSale.remainingAmount.toFixed(0)}€</span>
                </div>
              </div>

              <div>
                <Label htmlFor="followUpAmount" className="text-sm font-medium">Montant du paiement</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="followUpAmount"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={followUpAmount}
                    onChange={(e) => setFollowUpAmount(e.target.value)}
                    data-testid="input-followup-amount"
                  />
                  <span className="text-lg font-medium">€</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={payFullRemaining}
                  disabled={updatePaymentMutation.isPending}
                  data-testid="button-pay-full"
                >
                  Tout payer ({paymentDialogSale.remainingAmount.toFixed(0)}€)
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFollowUpPayment}
                  disabled={!followUpAmount || updatePaymentMutation.isPending}
                  data-testid="button-pay-partial"
                >
                  {updatePaymentMutation.isPending ? "..." : "Confirmer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!saleToDelete} onOpenChange={(open) => !open && setSaleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette vente ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La vente sera supprimée définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => saleToDelete && deleteSaleMutation.mutate(saleToDelete.id)}
              disabled={deleteSaleMutation.isPending}
            >
              {deleteSaleMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
