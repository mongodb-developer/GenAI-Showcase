import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const notificationVariants = cva(
  "fixed bottom-4 right-4 w-full max-w-sm overflow-hidden rounded-lg shadow-lg",
  {
    variants: {
      variant: {
        default: "bg-white",
        destructive: "bg-red-600 text-white",
        success: "bg-green-600 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface NotificationProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof notificationVariants> {
  title: string
  message: string
  duration?: number
}

export function Notification({
  className,
  variant,
  title,
  message,
  duration = 5000,
  ...props
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  if (!isVisible) return null

  return (
    <div
      className={cn(notificationVariants({ variant }), className)}
      {...props}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-1 text-sm">{message}</p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="ml-4 inline-flex shrink-0 rounded-md bg-white/10 p-1.5 text-white hover:bg-white/20"
          >
            <span className="sr-only">Close</span>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

