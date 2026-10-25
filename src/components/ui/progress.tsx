"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
<<<<<<< HEAD
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Optional override for the fill bar (e.g. brand color). */
  indicatorClassName?: string
}) {
=======
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
>>>>>>> upload/tech360-production-final
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
<<<<<<< HEAD
        className={cn("bg-primary h-full w-full flex-1 transition-all", indicatorClassName)}
=======
        className="bg-primary h-full w-full flex-1 transition-all"
>>>>>>> upload/tech360-production-final
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
