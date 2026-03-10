import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppDock } from "@/components/app-dock";
import { Package, LogOut } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Stock from "@/pages/stock";
import Clients from "@/pages/clients";
import Sales from "@/pages/sales";
import Estimates from "@/pages/estimates";
import Orders from "@/pages/orders";
import Login from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/stock" component={Stock} />
      <Route path="/clients" component={Clients} />
      <Route path="/sales" component={Sales} />
      <Route path="/estimates" component={Estimates} />
      <Route path="/orders" component={Orders} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    if (location === "/login") {
      setAuthStatus("unauthenticated");
      return;
    }
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) setAuthStatus("authenticated");
        else setAuthStatus("unauthenticated");
      })
      .catch(() => setAuthStatus("unauthenticated"));
  }, [location]);

  if (location === "/login") {
    return <Login />;
  }
  if (authStatus === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }
  if (authStatus === "unauthenticated") {
    return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

const pageTitles: Record<string, string> = {
  "/": "Accueil",
  "/stock": "Produits",
  "/clients": "Clients",
  "/sales": "Ventes",
  "/estimates": "Devis",
  "/orders": "Commandes",
};

function AppLayout() {
  const [location] = useLocation();
  const pageTitle = pageTitles[location] || "StockPro";

  return (
    <div className="flex flex-col h-dvh h-screen w-full min-h-0 bg-gradient-to-b from-[#fdfaf7] to-white dark:from-background dark:to-background">
      <header className="flex h-14 min-h-[3.5rem] items-center justify-between gap-3 bg-background/90 backdrop-blur-sm px-4 sm:px-6 shrink-0 border-b border-gold/20">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-display font-medium text-base hidden sm:inline tracking-wide">StockPro</span>
          </Link>
          <span className="text-muted-foreground/40 hidden sm:inline text-sm">›</span>
          <span className="text-sm font-medium text-muted-foreground truncate">{pageTitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <form
            action="/api/auth/logout"
            method="post"
            onSubmit={async (e) => {
              e.preventDefault();
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
          >
            <Button type="submit" variant="ghost" size="icon" title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-auto min-h-0 pb-24">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <Router />
        </div>
      </main>
      <AppDock />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="stockpro-theme">
        <TooltipProvider>
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
