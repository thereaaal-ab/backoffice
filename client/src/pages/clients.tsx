import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Phone, Mail, Store, Users, ShoppingBag } from "lucide-react";
import { PageBanner } from "@/components/page-banner";
import type { StorefrontClientSummary, Order } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ---------- helpers ----------

function orderTotal(o: Order): number {
  const r = o as Record<string, unknown>;
  return Number(r.totalAmount ?? r.total_amount ?? 0);
}
function orderPaid(o: Order): number {
  const r = o as Record<string, unknown>;
  return Number(r.paidAmount ?? r.paid_amount ?? 0);
}
function orderStatus(o: Order): string {
  const r = o as Record<string, unknown>;
  return String(r.paymentStatus ?? r.payment_status ?? "unpaid");
}
function orderDate(o: Order): Date {
  const r = o as Record<string, unknown>;
  return new Date((r.createdAt ?? r.created_at) as string);
}
function orderId(o: Order): string {
  return String((o as Record<string, unknown>).id ?? "");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid")
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Payé</Badge>;
  if (status === "partial")
    return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Partiel</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Non payé</Badge>;
}

// ---------- client detail modal ----------

function ClientDetail({ client }: { client: StorefrontClientSummary }) {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gold/20 bg-muted/20 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total commandé</p>
          <p className="font-display font-medium text-primary text-xl">{client.totalSpent.toFixed(2)} €</p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-muted/20 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Déjà payé</p>
          <p className="font-display font-medium text-green-700 dark:text-green-400 text-xl">
            {client.paidAmount.toFixed(2)} €
          </p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-muted/20 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Reste à payer</p>
          <p className={`font-display font-medium text-xl ${client.toCollect > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {client.toCollect.toFixed(2)} €
          </p>
        </div>
      </div>

      {/* Orders table */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Commandes ({client.orders.length})
        </p>
        <div className="rounded-xl border border-gold/20 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-border/60">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-right text-muted-foreground">Total</TableHead>
                <TableHead className="text-right text-muted-foreground">Payé</TableHead>
                <TableHead className="text-right text-muted-foreground">Reste</TableHead>
                <TableHead className="text-center text-muted-foreground">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.orders.map((o) => {
                const total = orderTotal(o);
                const paid = orderPaid(o);
                const remaining = total - paid;
                return (
                  <TableRow key={orderId(o)} className="border-border/40">
                    <TableCell className="text-sm">
                      {format(orderDate(o), "d MMM yyyy · HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {total.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {paid.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right text-amber-600 dark:text-amber-400">
                      {remaining > 0 ? `${remaining.toFixed(2)} €` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={orderStatus(o)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ---------- main page ----------

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<StorefrontClientSummary | null>(null);

  const { data: clients = [], isLoading } = useQuery<StorefrontClientSummary[]>({
    queryKey: ["/api/storefront-clients"],
    refetchOnWindowFocus: true,
  });

  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="pb-5 mb-4 border-b border-border/60">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-48 mb-3" />
          <Skeleton className="h-px w-12" />
        </div>
        <Skeleton className="h-11 w-full max-w-md rounded-lg" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 py-5 px-5">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
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
    <div className="space-y-5">
      <PageBanner
        breadcrumb="Backoffice"
        title="Clients"
        subtitle="Clients ayant passé une commande depuis la boutique en ligne"
      />

      {/* search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Rechercher par nom, téléphone, email..."
          className="pl-10 min-h-11 rounded-lg border-gold/20 focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="overflow-hidden hover:border-primary/30 transition-all hover:shadow-md cursor-pointer group"
              onClick={() => setSelectedClient(client)}
            >
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 px-5">
                {/* avatar + info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <span className="text-primary text-lg font-display font-medium">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-medium text-base truncate mb-0.5">{client.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />{client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <Mail className="h-3 w-3 shrink-0" />{client.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* stats */}
                <div className="flex items-center gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-muted-foreground mb-0.5">Commandes</p>
                    <p className="font-medium text-sm flex items-center justify-center gap-1">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                      {client.orderCount}
                    </p>
                  </div>
                  <div className="text-center min-w-[70px]">
                    <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                    <p className="font-display font-medium text-primary text-base">{client.totalSpent.toFixed(0)} €</p>
                  </div>
                  {client.toCollect > 0 && (
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-muted-foreground mb-0.5">Reste</p>
                      <p className="font-medium text-sm text-amber-600 dark:text-amber-400">
                        {client.toCollect.toFixed(0)} €
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-gold/20">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-display text-xl font-medium mb-2">Aucun client</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {searchQuery
                ? "Aucun client ne correspond à votre recherche"
                : "Les clients apparaîtront ici automatiquement dès qu'une commande est passée sur la boutique"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* detail modal */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {selectedClient && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xl font-display font-medium">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="font-display text-xl font-medium">
                      {selectedClient.name}
                    </DialogTitle>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {selectedClient.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />{selectedClient.phone}
                        </span>
                      )}
                      {selectedClient.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />{selectedClient.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge className="w-fit bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 text-xs uppercase tracking-widest">
                  <Store className="h-3 w-3 mr-1.5" />Client boutique
                </Badge>
                <div className="mt-3 h-px w-12 bg-gold/60" />
              </DialogHeader>

              <div className="px-6 py-5">
                <ClientDetail client={selectedClient} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
