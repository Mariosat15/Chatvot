"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
    container?: HTMLElement | null
    /** Makes dialog full-screen on mobile devices */
    fullScreenMobile?: boolean
    /** Size variant for the dialog */
    size?: 'sm' | 'default' | 'lg' | 'xl' | 'full'
  }
>(({ className, children, showCloseButton = true, container, fullScreenMobile = false, size = 'default', ...props }, ref) => {
  const sizeClasses = {
    sm: 'sm:max-w-sm',
    default: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-[calc(100%-2rem)]',
  }

  // Full-screen mobile classes
  const mobileFullScreenClasses = fullScreenMobile
    ? 'max-sm:fixed max-sm:inset-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:top-0 max-sm:left-0 max-sm:max-w-none max-sm:max-h-none max-sm:h-full max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:data-[state=open]:animate-slide-up max-sm:data-[state=closed]:animate-slide-down'
    : 'max-w-[calc(100%-1rem)]'

  return (
    <DialogPortal data-slot="dialog-portal" container={container}>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed z-50 grid w-full gap-4 border p-4 sm:p-6 shadow-lg duration-200 overflow-y-auto",
          // Default centered positioning for desktop
          !fullScreenMobile && "top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] rounded-lg max-h-[90vh] data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          // When fullScreenMobile, use different positioning on mobile
          fullScreenMobile && "sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:max-h-[90vh] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          mobileFullScreenClasses,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 z-10 bg-background",
              // Larger touch target on mobile
              fullScreenMobile 
                ? "top-2 right-2 p-2 sm:top-4 sm:right-4 sm:p-0 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4"
                : "top-3 right-3 sm:top-4 sm:right-4 [&_svg:not([class*='size-'])]:size-4"
            )}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
