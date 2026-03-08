import { cn } from "@/lib/utils";

interface PageBannerProps {
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export function PageBanner({ breadcrumb, title, subtitle, className }: PageBannerProps) {
  return (
    <div className={cn("pb-5 mb-4 border-b border-border/60", className)}>
      {breadcrumb && (
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {breadcrumb}
        </p>
      )}
      <h1 className="font-display text-2xl sm:text-3xl font-medium text-foreground leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
      )}
      <div className="mt-3 h-px w-12 bg-gold/60" />
    </div>
  );
}
