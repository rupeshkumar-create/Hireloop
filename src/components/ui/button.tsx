import * as React from "react"
import { cn } from "@/lib/utils"

type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "destructive" | "action"
type ButtonSize = "default" | "sm" | "lg" | "icon"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant, size?: ButtonSize }>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898ec] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-foreground text-surface shadow-[0_0_0_1px_var(--color-near-black)] hover:opacity-95": variant === "default",
            "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--color-terracotta)] hover:brightness-95": variant === "action",
            "bg-surface-hover text-foreground shadow-[0_0_0_1px_var(--color-ring)] hover:bg-border": variant === "secondary",
            "border border-border bg-surface text-foreground hover:bg-surface-hover hover:text-foreground": variant === "outline",
            "text-foreground-muted hover:bg-surface-hover hover:text-foreground": variant === "ghost",
            "bg-[var(--color-error)] text-surface hover:brightness-95": variant === "destructive",
            "h-10 px-4 py-2": size === "default",
            "h-9 px-3 text-xs": size === "sm",
            "h-11 px-8 text-base": size === "lg",
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
