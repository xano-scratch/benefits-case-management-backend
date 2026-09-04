import * as React from "react"

import { cn } from "@/lib/utils"

// A lightweight styled native select. The app's dropdowns are simple lists, so
// a native <select> keeps the contract small and the markup accessible.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input dark:bg-input/30 bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    />
  )
}

export { Select }
