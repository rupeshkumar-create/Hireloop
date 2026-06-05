import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' }>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-[border-color,background-color,color,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:shadow-[var(--ember-glow)]",
          {
            "border-border bg-surface-hover text-foreground": variant === "default",
            "border-border bg-transparent text-foreground-muted": variant === "secondary",
            "border-border bg-transparent text-foreground": variant === "outline",
            "border-transparent bg-[rgba(217,110,110,0.16)] text-[var(--signal-error)]": variant === "destructive",
            "border-transparent bg-[rgba(127,184,147,0.16)] text-[var(--signal-success)]": variant === "success",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
