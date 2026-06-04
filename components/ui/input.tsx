import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base
          "flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground",
          // Border & ring
          "border-input ring-offset-background",
          // Placeholder
          "placeholder:text-muted-foreground/60",
          // File input
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Focus
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
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
