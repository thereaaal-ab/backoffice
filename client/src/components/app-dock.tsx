import { useLocation, Link } from "wouter";
import { Package, Users, ShoppingCart, FileText, Home, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const dockItems = [
  { title: "Accueil", url: "/", icon: Home },
  { title: "Produits", url: "/stock", icon: Package },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Ventes", url: "/sales", icon: ShoppingCart },
  { title: "Commandes", url: "/orders", icon: ShoppingBag },
  { title: "Devis", url: "/estimates", icon: FileText },
];

export function AppDock() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center px-2 py-2 rounded-2xl bg-background/95 dark:bg-card border border-gold/20 shadow-lg shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-background/90"
      aria-label="Navigation principale"
    >
      <div className="flex items-center gap-1">
        {dockItems.map((item) => {
          const isActive = location === item.url;
          const testId = `nav-${item.url.slice(1) || "home"}`;
          return (
            <Link
              key={item.title}
              href={item.url}
              data-testid={testId}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <item.icon className={cn("shrink-0 transition-all duration-200", isActive ? "h-5 w-5" : "h-5 w-5")} aria-hidden />
              <span className={cn(
                "text-[10px] font-medium leading-none tracking-wide transition-all duration-200",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
