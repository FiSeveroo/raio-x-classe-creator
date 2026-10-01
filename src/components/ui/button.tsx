import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Hierarquia da marca: verde = ação principal · laranja = CTA de impacto · roxo = secundária.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-110',
        cta: 'bg-cc-orange text-destructive-foreground hover:brightness-110 shadow-[0_0_0_1px_rgba(211,108,39,0.4),0_8px_24px_-8px_rgba(211,108,39,0.6)]',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-125',
        outline: 'border border-cc-line bg-transparent text-foreground hover:bg-cc-surface-2 hover:border-[#3a3a40]',
        ghost: 'text-muted-foreground hover:bg-cc-surface-2 hover:text-foreground',
        link: 'h-auto px-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'size-9',
      },
      font: {
        default: '',
        display: 'font-display text-base',
        caps: 'label-caps',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      font: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  font,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, font, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
