import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'action', size?: 'default' | 'sm' | 'lg' | 'icon' }>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-foreground text-surface hover:opacity-90": variant === "default",
            "bg-orange-500 text-surface hover:bg-orange-600": variant === "action",
            "bg-surface-hover text-foreground hover:bg-border": variant === "secondary",
            "border border-border bg-surface hover:bg-surface-hover hover:text-foreground": variant === "outline",
            "hover:bg-surface-hover hover:text-foreground": variant === "ghost",
            "bg-red-500 text-surface hover:bg-red-600": variant === "destructive",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
