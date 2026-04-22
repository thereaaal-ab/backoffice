import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash2, Search, Download, Eye, EyeOff } from "lucide-react";
import { PageBanner } from "@/components/page-banner";
import type { EstimateWithDetails, Client, ProductWithVariants } from "@shared/schema";

type ProductCategory = { id: string; slug: string; name: string };
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EstimateItem {
  productName: string;
  quantity: number;
  supplierPrice: number;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  finalPrice: number;
}

export default function Estimates() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([]);
  const [showHiddenColumns, setShowHiddenColumns] = useState(true);
  
  const [selectedCategoryForProduct, setSelectedCategoryForProduct] = useState<string>("__all__");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [newProductName, setNewProductName] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newSupplierPrice, setNewSupplierPrice] = useState("");
  const [newCommissionType, setNewCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [newCommissionValue, setNewCommissionValue] = useState("");

  const { data: estimates, isLoading } = useQuery<EstimateWithDetails[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products = [] } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/products"],
  });

  const CATEGORY_ALL = "__all__";
  const productsInCategory =
    selectedCategoryForProduct && selectedCategoryForProduct !== CATEGORY_ALL
      ? products.filter((p) => p.category === selectedCategoryForProduct)
      : products;

  const createEstimateMutation = useMutation({
    mutationFn: async (data: { clientId?: string; items: EstimateItem[] }) => {
      return apiRequest("POST", "/api/estimates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setIsDialogOpen(false);
      setEstimateItems([]);
      setSelectedClientId("");
      toast({
        title: "Devis créé",
        description: "Le devis a été créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le devis",
        variant: "destructive",
      });
    },
  });

  const calculateFinalPrice = (supplierPrice: number, commissionType: "percentage" | "fixed", commissionValue: number): number => {
    if (commissionType === "percentage") {
      return supplierPrice * (1 + commissionValue / 100);
    }
    return supplierPrice + commissionValue;
  };

  const addItem = () => {
    if (!newProductName || !newSupplierPrice || !newCommissionValue) {
      toast({
        title: "Erreur",
        description: "Veuillez choisir un produit et remplir prix et commission",
        variant: "destructive",
      });
      return;
    }

    const supplierPrice = parseFloat(newSupplierPrice);
    const commissionValue = parseFloat(newCommissionValue);
    const finalPrice = calculateFinalPrice(supplierPrice, newCommissionType, commissionValue);

    setEstimateItems([...estimateItems, {
      productName: newProductName,
      quantity: newQuantity,
      supplierPrice,
      commissionType: newCommissionType,
      commissionValue,
      finalPrice,
    }]);

    setSelectedProductId("");
    setNewProductName("");
    setNewQuantity(1);
    setNewSupplierPrice("");
    setNewCommissionValue("");
  };

  const removeItem = (index: number) => {
    setEstimateItems(estimateItems.filter((_, i) => i !== index));
  };

  const totals = estimateItems.reduce((acc, item) => ({
    supplier: acc.supplier + (item.supplierPrice * item.quantity),
    final: acc.final + (item.finalPrice * item.quantity),
  }), { supplier: 0, final: 0 });

  const totalCommission = totals.final - totals.supplier;

  const onSubmit = () => {
    if (estimateItems.length === 0) {
      toast({
        title: "Erreur",
        description: "Ajoutez au moins un article",
        variant: "destructive",
      });
      return;
    }

    createEstimateMutation.mutate({
      clientId: selectedClientId || undefined,
      items: estimateItems,
    });
  };

  const exportExcel = async (estimateId: string) => {
    try {
      const response = await fetch(`/api/estimates/${estimateId}/export`);
      if (!response.ok) throw new Error();
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis-${estimateId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export réussi",
        description: "Le fichier Excel a été téléchargé",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter le devis",
        variant: "destructive",
      });
    }
  };

  const filteredEstimates = estimates?.filter((estimate) => {
    if (!searchQuery) return true;
    const clientMatch = estimate.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return clientMatch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
      sent: { label: "Envoyé", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
      accepted: { label: "Accepté", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
      rejected: { label: "Refusé", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
    };
    const variant = variants[status] || variants.draft;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 py-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageBanner
        breadcrumb="Backoffice"
        title="Devis"
        subtitle="Créez des estimations avec marge cachée"
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="relative flex-1 w-full min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher un devis..."
            className="pl-10 min-h-11 sm:min-h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-estimate"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEstimateItems([]);
            setSelectedClientId("");
            setSelectedCategoryForProduct(CATEGORY_ALL);
            setSelectedProductId("");
            setNewProductName("");
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto min-h-11 sm:min-h-10" data-testid="button-new-estimate">
              <Plus className="h-4 w-4 mr-2 shrink-0" />
              Nouveau devis
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouveau devis</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Client</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger data-testid="select-estimate-client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm">Ajouter un article</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Catégorie</label>
                    <Select
                      value={selectedCategoryForProduct}
                      onValueChange={(v) => {
                        setSelectedCategoryForProduct(v);
                        setSelectedProductId("");
                        setNewProductName("");
                        setNewSupplierPrice("");
                      }}
                      data-testid="select-estimate-category"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Toutes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CATEGORY_ALL}>Toutes</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Produit</label>
                    <Select
                      value={selectedProductId}
                      onValueChange={(id) => {
                        const product = products.find((p) => p.id === id);
                        if (product) {
                          setSelectedProductId(id);
                          setNewProductName(product.name);
                          setNewSupplierPrice(String(Number(product.defaultPrice)));
                        }
                      }}
                      disabled={productsInCategory.length === 0}
                      data-testid="select-estimate-product"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCategoryForProduct !== CATEGORY_ALL ? "Choisir un produit" : "Choisir une catégorie (ou Toutes)"} />
                      </SelectTrigger>
                      <SelectContent>
                        {productsInCategory.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quantité</label>
                    <Input
                      type="number"
                      min="1"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                      data-testid="input-estimate-quantity"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Prix fournisseur</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={newSupplierPrice}
                      onChange={(e) => setNewSupplierPrice(e.target.value)}
                      data-testid="input-estimate-supplier-price"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type commission</label>
                    <Select value={newCommissionType} onValueChange={(v: "percentage" | "fixed") => setNewCommissionType(v)}>
                      <SelectTrigger data-testid="select-commission-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">Fixe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Commission {newCommissionType === "percentage" ? "(%)" : "(€)"}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={newCommissionValue}
                      onChange={(e) => setNewCommissionValue(e.target.value)}
                      data-testid="input-estimate-commission"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={addItem}
                  size="sm"
                  className="w-full"
                  data-testid="button-add-estimate-item"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>

              {estimateItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm">Articles ({estimateItems.length})</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHiddenColumns(!showHiddenColumns)}
                    >
                      {showHiddenColumns ? (
                        <><EyeOff className="h-4 w-4 mr-2" />Masquer privé</>
                      ) : (
                        <><Eye className="h-4 w-4 mr-2" />Afficher privé</>
                      )}
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-center w-16">Qté</TableHead>
                          {showHiddenColumns && (
                            <>
                              <TableHead className="text-right bg-amber-50 dark:bg-amber-900/20">Fournisseur</TableHead>
                              <TableHead className="text-right bg-amber-50 dark:bg-amber-900/20">Commission</TableHead>
                            </>
                          )}
                          <TableHead className="text-right">Prix</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {estimateItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            {showHiddenColumns && (
                              <>
                                <TableCell className="text-right bg-amber-50 dark:bg-amber-900/20">
                                  {item.supplierPrice.toFixed(0)}€
                                </TableCell>
                                <TableCell className="text-right bg-amber-50 dark:bg-amber-900/20">
                                  {item.commissionType === "percentage" 
                                    ? `${item.commissionValue}%`
                                    : `${item.commissionValue.toFixed(0)}€`}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-right font-semibold">
                              {(item.finalPrice * item.quantity).toFixed(0)}€
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="pt-4 space-y-2">
                    {showHiddenColumns && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>Votre marge</span>
                        <span>+{totalCommission.toFixed(0)}€</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2 text-lg font-bold">
                      <span>Total client</span>
                      <span>{totals.final.toFixed(0)}€</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={onSubmit}
                  disabled={estimateItems.length === 0 || createEstimateMutation.isPending}
                  data-testid="button-submit-estimate"
                >
                  {createEstimateMutation.isPending ? "..." : "Créer le devis"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filteredEstimates && filteredEstimates.length > 0 ? (
        <div className="space-y-3">
          {filteredEstimates.map((estimate) => (
            <Card key={estimate.id} className="hover-elevate transition-shadow hover:shadow-md" data-testid={`row-estimate-${estimate.id}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20 shrink-0">
                    <FileText className="h-5 w-5 text-gold dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium">
                      {estimate.client?.name || "Non assigné"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(estimate.createdAt), "d MMM yyyy", { locale: fr })}
                      {" · "}
                      {estimate.items.length} article{estimate.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {getStatusBadge(estimate.status)}
                  <div className="text-right">
                    <p className="font-bold text-lg text-primary">{estimate.totalClientPrice.toFixed(0)} €</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      +{estimate.totalCommission.toFixed(0)}€ marge
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => exportExcel(estimate.id)}
                    title="Exporter Excel"
                    className="hover:text-primary"
                    data-testid={`button-export-${estimate.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun devis</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              {searchQuery
                ? "Aucun devis ne correspond à votre recherche"
                : "Créez votre premier devis avec marge cachée"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau devis
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
