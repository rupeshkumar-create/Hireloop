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
          "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-[background-color,border-color,color,transform] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:shadow-[var(--ember-glow)] disabled:pointer-events-none disabled:opacity-40",
          {
            "border border-border bg-surface-hover text-foreground hover:border-[var(--ember-400)] focus-visible:border-[var(--ember-400)] active:bg-[var(--ember-tint)] active:scale-[0.985]":
              variant === "default" || variant === "action",
            "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-surface-hover":
              variant === "outline" || variant === "secondary",
            "border border-transparent bg-transparent text-foreground-muted hover:text-foreground hover:underline hover:decoration-[var(--ember-400)] hover:decoration-2 hover:underline-offset-4": variant === "ghost",
            "border border-transparent bg-[var(--signal-error)] text-[var(--bg-primary)] hover:opacity-95 active:scale-[0.985]": variant === "destructive",
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
