import React from "react"
import { cn } from "@/lib/utils"

type PageShellProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl space-y-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-4xl text-foreground md:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-base leading-7 text-foreground-muted md:text-lg">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
