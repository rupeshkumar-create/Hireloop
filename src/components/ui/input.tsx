import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-border bg-surface-hover px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow,background-color] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-foreground-muted focus-visible:outline-none focus-visible:border-[var(--ember-400)] focus-visible:shadow-[var(--ember-glow)] hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
