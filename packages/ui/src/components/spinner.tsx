import { HugeiconsIcon } from "@hugeicons/react"
import { Loading02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<typeof HugeiconsIcon>, "icon">) {
  return (
    <HugeiconsIcon
      icon={Loading02Icon}
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      strokeWidth={2}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
