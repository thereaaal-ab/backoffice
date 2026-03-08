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
} from "@/components/ui/dialog";
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
import { ShoppingBag, Search, CreditCard, Phone, Mail, User, Calendar } from "lucide-react";
import { PageBanner } from "@/components/page-banner";
import type { Order, OrderWithDetails } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Orders() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [detailOrder, setDetailOrder] = useState<OrderWithDetails | null>(null);
  const [additionalPayment, setAdditionalPayment] = useState("");

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchOnWindowFocus: true,
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ orderId, additionalAmount }: { orderId: string; additionalAmount: number }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/payment`, { additionalAmount });
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setAdditionalPayment("");
      // Normalize: API may return camelCase or snake_case; ensure modal shows new "Déjà payé" / "Reste à payer"
      const paid = updatedOrder.paidAmount ?? updatedOrder.paid_amount ?? 0;
      const status = (updatedOrder.paymentStatus ?? updatedOrder.payment_status ?? "unpaid") as string;
      const paidAmount = typeof paid === "number" ? String(paid) : String(Number(paid) || 0);
      setDetailOrder((prev) =>
        prev
          ? { ...prev, paidAmount, paymentStatus: status }
          : null
      );
      toast({
        title: "Paiement enregistré",
        description: "Le paiement a été ajouté à la commande",
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

  const openDetail = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      if (!res.ok) throw new Error();
      const data: OrderWithDetails = await res.json();
      setDetailOrder(data);
      setAdditionalPayment("");
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger la commande",
        variant: "destructive",
      });
    }
  };

  const filteredOrders = orders?.filter((o) => {
    const name = (o.firstName ?? "").toLowerCase();
    const phone = (o.phone ?? "").toLowerCase();
    const email = (o.email ?? "").toLowerCase();
    const q = searchQuery.toLowerCase();
    return !q || name.includes(q) || phone.includes(q) || email.includes(q);
  });

  const getStatusLabel = (status: string, order: Order) => {
    const total = Number(order.totalAmount ?? 0);
    const paid = Number(order.paidAmount ?? 0);
    const remaining = total - paid;
    const percentLeft = total > 0 ? Math.round((remaining / total) * 100) : 0;
    if (status === "paid") return { label: "Payé", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0" };
    if (status === "partial") return { label: `Partiel (${percentLeft} % restant)`, className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0" };
    return { label: "Non payé", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0" };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="pb-5 mb-4 border-b border-border/60">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-48 mb-3" />
          <Skeleton className="h-px w-12" />
        </div>
        <div className="relative max-w-md mb-6">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 py-5 px-5">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner
        breadcrumb="Backoffice"
        title="Commandes"
        subtitle="Commandes passées depuis la boutique en ligne"
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Rechercher par nom, téléphone, email..."
          className="pl-10 min-h-11 rounded-lg border-gold/20 focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredOrders && filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const total = Number(order.totalAmount ?? 0);
            const paid = Number(order.paidAmount ?? 0);
            const remaining = total - paid;
            const statusInfo = getStatusLabel(order.paymentStatus, order);
            return (
              <Card
                key={order.id}
                className="overflow-hidden hover:border-primary/30 transition-all hover:shadow-md cursor-pointer group"
                onClick={() => openDetail(order)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row sm:items-stretch gap-0">
                    {/* Client block */}
                    <div className="flex flex-1 items-center gap-4 p-5 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-0.5">Client</p>
                        <h3 className="font-display font-medium text-lg truncate">{order.firstName}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(order.createdAt), "d MMM yyyy · HH:mm", { locale: fr })}
                        </p>
                        {(order.phone || order.email) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                            {order.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                {order.phone}
                              </span>
                            )}
                            {order.email && (
                              <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none">
                                <Mail className="h-3 w-3 shrink-0" />
                                {order.email}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="h-px sm:h-auto sm:w-px bg-border/60 sm:mx-0" />
                    {/* Amounts + actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 p-5 sm:pl-6 sm:pr-5 sm:min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <span className="font-display font-medium text-primary text-lg">
                          {total.toFixed(2)} €
                        </span>
                        <span className="text-sm text-muted-foreground">Payé : {paid.toFixed(2)} €</span>
                        {remaining > 0 && (
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                            Reste : {remaining.toFixed(2)} €
                          </span>
                        )}
                        <Badge className={`rounded-full text-xs font-medium ${statusInfo.className}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-gold/30 hover:border-primary hover:text-primary text-xs tracking-wide"
                        onClick={(e) => { e.stopPropagation(); openDetail(order); }}
                      >
                        Détails
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-gold/20">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-display text-xl font-medium mb-2">Aucune commande</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {searchQuery
                ? "Aucune commande ne correspond à votre recherche"
                : "Les commandes passées sur la boutique apparaîtront ici"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          {detailOrder && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Commande</p>
                <DialogTitle className="font-display text-xl font-medium">
                  #{detailOrder.id.slice(0, 8)}
                </DialogTitle>
                <div className="mt-2 h-px w-12 bg-gold/60" />
              </DialogHeader>

              <div className="px-6 py-5 space-y-6">
                {/* Client card */}
                <div className="rounded-xl border border-gold/20 bg-card p-5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Client</p>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-medium text-lg">{detailOrder.firstName}</p>
                      {detailOrder.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <Phone className="h-3.5 w-3.5 shrink-0" /> {detailOrder.phone}
                        </p>
                      )}
                      {detailOrder.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {detailOrder.email}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(detailOrder.createdAt), "d MMM yyyy à HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Items table */}
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Articles</p>
                  <div className="rounded-xl border border-gold/20 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                          <TableHead className="font-medium">Produit</TableHead>
                          <TableHead className="text-center w-16 text-muted-foreground">Taille</TableHead>
                          <TableHead className="text-center w-14 text-muted-foreground">Qté</TableHead>
                          <TableHead className="text-right text-muted-foreground">Prix unit.</TableHead>
                          <TableHead className="text-right font-medium">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailOrder.items.map((item) => (
                          <TableRow key={item.id} className="border-border/40">
                            <TableCell className="font-medium">{item.productName ?? "—"}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{item.size ?? "—"}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{Number(item.priceAtTime).toFixed(2)} €</TableCell>
                            <TableCell className="text-right font-medium text-primary">
                              {(Number(item.priceAtTime) * item.quantity).toFixed(2)} €
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-gold/20 bg-muted/20 p-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total commande</span>
                    <span className="font-display font-medium text-primary text-lg">{Number(detailOrder.totalAmount ?? 0).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Déjà payé</span>
                    <span>{Number(detailOrder.paidAmount ?? 0).toFixed(2)} €</span>
                  </div>
                  {Number(detailOrder.totalAmount ?? 0) - Number(detailOrder.paidAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-sm font-medium text-amber-600 dark:text-amber-400 pt-1 border-t border-border/60">
                      <span>Reste à payer</span>
                      <span>{(Number(detailOrder.totalAmount ?? 0) - Number(detailOrder.paidAmount ?? 0)).toFixed(2)} €</span>
                    </div>
                  )}
                </div>

                {/* Payment form */}
                {Number(detailOrder.totalAmount ?? 0) - Number(detailOrder.paidAmount ?? 0) > 0 && (
                  <div className="pt-4 border-t border-border/60 space-y-3">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Enregistrer un paiement
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Montant (€)"
                        className="rounded-lg border-gold/20 focus:border-primary max-w-[140px]"
                        value={additionalPayment}
                        onChange={(e) => setAdditionalPayment(e.target.value)}
                      />
                      <Button
                        className="bg-gray-900 hover:bg-primary text-xs uppercase tracking-widest"
                        onClick={() => {
                          const amount = parseFloat(additionalPayment);
                          if (isNaN(amount) || amount <= 0) {
                            toast({
                              title: "Montant invalide",
                              variant: "destructive",
                            });
                            return;
                          }
                          updatePaymentMutation.mutate({
                            orderId: detailOrder.id,
                            additionalAmount: amount,
                          });
                        }}
                        disabled={updatePaymentMutation.isPending}
                      >
                        {updatePaymentMutation.isPending ? "..." : "Ajouter"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
