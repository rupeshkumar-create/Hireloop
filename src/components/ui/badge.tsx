import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' }>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2",
          {
            "border-transparent bg-foreground text-surface hover:opacity-90": variant === "default",
            "border-transparent bg-surface-hover text-foreground hover:bg-border": variant === "secondary",
            "text-foreground border-border": variant === "outline",
            "border-transparent bg-red-100 text-red-900 hover:bg-red-200": variant === "destructive",
            "border-transparent bg-orange-100 text-orange-900 hover:bg-orange-200": variant === "success",
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
