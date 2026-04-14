import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' }>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3898ec] focus:ring-offset-2",
          {
            "border-transparent bg-foreground text-surface hover:opacity-90": variant === "default",
            "border-transparent bg-surface-hover text-foreground hover:bg-border": variant === "secondary",
            "border-border bg-surface text-foreground": variant === "outline",
            "border-transparent bg-[rgba(181,51,51,0.12)] text-[var(--color-error)]": variant === "destructive",
            "border-transparent bg-[rgba(201,100,66,0.14)] text-[var(--color-terracotta)]": variant === "success",
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
