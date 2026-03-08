import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Users, ShoppingCart, FileText, ArrowRight, AlertTriangle, TrendingUp, Plus, Banknote, Wallet, Receipt, PieChart } from "lucide-react";
import { PageBanner } from "@/components/page-banner";

interface DashboardStats {
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
  recentSales: Array<{
    id: string;
    clientName: string;
    amount: string;
    date: string;
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    totalStock: number;
  }>;
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-px w-8 mb-2" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div className="pb-5 mb-2 border-b border-border/50">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-56 mb-3" />
          <Skeleton className="h-px w-12" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-6">
          <Skeleton className="h-3 w-28 mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-6">
          <Skeleton className="h-3 w-32 mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div>
          <Skeleton className="h-3 w-28 mb-4" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Produits",
      value: stats?.totalProducts ?? 0,
      sub: `${stats?.totalStock ?? 0} unités en stock`,
      icon: Package,
      href: "/stock",
      accent: "bg-primary/10 text-primary",
      testId: "card-stat-products",
    },
    {
      label: "Clients",
      value: stats?.totalClients ?? 0,
      sub: "Clients enregistrés",
      icon: Users,
      href: "/clients",
      accent: "bg-olive/10 text-olive dark:text-green-400",
      testId: "card-stat-clients",
    },
    {
      label: "Chiffre d'affaires (hypothétique)",
      value: `${Number(stats?.totalRevenue ?? 0).toFixed(0)} €`,
      sub: `Total des ventes · ${stats?.totalSales ?? 0} ventes`,
      icon: TrendingUp,
      href: "/sales",
      accent: "bg-primary/10 text-primary",
      isMoney: true,
      testId: "card-stat-sales",
    },
    {
      label: "Devis en attente",
      value: stats?.pendingEstimates ?? 0,
      sub: "À traiter",
      icon: FileText,
      href: "/estimates",
      accent: "bg-gold/10 text-gold dark:text-amber-400",
      testId: "card-stat-estimates",
    },
  ];

  const financeCards = [
    {
      label: "Montant déjà encaissé",
      value: `${Number(stats?.amountCollected ?? 0).toFixed(0)} €`,
      sub: "Sommes déjà reçues (payé + partiel)",
      icon: Banknote,
      href: "/sales",
      accent: "bg-green-500/10 text-green-700 dark:text-green-400",
      testId: "card-stat-collected",
    },
    {
      label: "Reste à collecter",
      value: `${Number(stats?.amountToCollect ?? 0).toFixed(0)} €`,
      sub: "Encore à encaisser",
      icon: Wallet,
      href: "/sales",
      accent: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      testId: "card-stat-tocollect",
    },
    {
      label: "Ventes à solder",
      value: stats?.salesWithBalance ?? 0,
      sub: "Ventes avec solde restant",
      icon: Receipt,
      href: "/sales",
      accent: "bg-primary/10 text-primary",
      testId: "card-stat-with-balance",
    },
    {
      label: "Panier moyen",
      value: `${Number(stats?.averageBasket ?? 0).toFixed(0)} €`,
      sub: "Par vente",
      icon: PieChart,
      href: "/sales",
      accent: "bg-olive/10 text-olive dark:text-green-400",
      testId: "card-stat-avg-basket",
    },
  ];

  const quickActions = [
    { label: "Ajouter un produit", sub: "Nouveau produit", icon: Package, href: "/stock" },
    { label: "Nouveau client", sub: "Ajouter un client", icon: Users, href: "/clients" },
    { label: "Nouvelle vente", sub: "Enregistrer une vente", icon: ShoppingCart, href: "/sales" },
    { label: "Créer un devis", sub: "Estimation client", icon: FileText, href: "/estimates" },
  ];

  return (
    <div className="space-y-10 pb-4">
      <PageBanner
        breadcrumb="StockPro"
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre activité"
      />

      {/* Section: Vue d'ensemble */}
      <section className="rounded-2xl border border-border/60 bg-card/30 dark:bg-card/20 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Vue d'ensemble</p>
          <div className="flex-1 h-px bg-gold/30" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <Link href={card.href} key={card.label}>
              <div
                className="rounded-xl border border-border/50 bg-background dark:bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md cursor-pointer group"
                data-testid={card.testId}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium leading-tight">
                    {card.label}
                  </p>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${card.accent}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
                <p className={`text-2xl sm:text-3xl font-display font-medium leading-none tracking-tight ${card.isMoney ? "text-primary" : "text-foreground"}`}>
                  {card.value}
                </p>
                <div className="h-px w-10 bg-gold/40 mt-3 mb-2" />
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Section: Encaissements */}
      <section className="rounded-2xl border border-border/60 bg-card/30 dark:bg-card/20 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Encaissements</p>
          <div className="flex-1 h-px bg-gold/30" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {financeCards.map((card) => (
            <Link href={card.href} key={card.label}>
              <div
                className="rounded-xl border border-border/50 bg-background dark:bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md cursor-pointer group"
                data-testid={card.testId}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium leading-tight">
                    {card.label}
                  </p>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${card.accent}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-display font-medium leading-none tracking-tight text-foreground">
                  {card.value}
                </p>
                <div className="h-px w-10 bg-gold/40 mt-3 mb-2" />
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Section: Activité récente + Alertes */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden border border-border/60 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 px-6 pt-6 bg-muted/20 dark:bg-muted/10">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-0.5">Activité</p>
              <CardTitle className="font-display text-lg font-medium">Ventes récentes</CardTitle>
            </div>
            <Link href="/sales">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-1 text-xs">
                Tout voir <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              <ul className="divide-y divide-border/40 rounded-lg">
                {stats.recentSales.slice(0, 5).map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    data-testid={`sale-item-${sale.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-display font-medium text-primary">
                          {(sale.clientName || "A").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{sale.clientName || "Anonyme"}</p>
                        <p className="text-xs text-muted-foreground">{sale.date}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-primary text-sm shrink-0 ml-4">+{sale.amount} €</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Aucune vente récente</p>
                <Link href="/sales">
                  <Button variant="ghost" size="sm" className="mt-2 text-primary hover:text-primary">
                    Créer une vente
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-border/60 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 px-6 pt-6 bg-muted/20 dark:bg-muted/10">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-0.5">Inventaire</p>
              <CardTitle className="font-display text-lg font-medium">Alertes stock</CardTitle>
            </div>
            <Link href="/stock">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-1 text-xs">
                Gérer <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4">
            {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              <ul className="divide-y divide-border/40 rounded-lg">
                {stats.lowStockProducts.slice(0, 5).map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    data-testid={`low-stock-${product.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="font-medium text-sm truncate">{product.name}</span>
                    </div>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium shrink-0">
                      {product.totalStock} restants
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Stock bien approvisionné</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Tous les produits sont en quantité suffisante</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section: Actions rapides */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Actions rapides</p>
          <div className="flex-1 h-px bg-gold/30" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link href={action.href} key={action.label}>
              <div className="rounded-xl border-2 border-dashed border-gold/30 bg-card/30 dark:bg-card/20 p-4 flex items-center gap-4 transition-all hover:border-primary/40 hover:bg-primary/5 group cursor-pointer">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/15">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-tight">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.sub}</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
