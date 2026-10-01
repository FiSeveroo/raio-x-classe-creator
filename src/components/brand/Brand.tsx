import { cn } from '@/lib/utils'

/** Rótulo pequeno em caixa alta acima de títulos e em status. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('label-caps text-muted-foreground', className)}>{children}</p>
}

/**
 * Título de seção principal — verde, Gunterz Black (diretriz da marca).
 * `tone="secondary"` usa o roxo para títulos secundários.
 */
export function SectionTitle({
  children,
  eyebrow,
  action,
  tone = 'primary',
  as: Tag = 'h2',
  className,
}: {
  children: React.ReactNode
  eyebrow?: React.ReactNode
  action?: React.ReactNode
  tone?: 'primary' | 'secondary'
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <Tag
          className={cn(
            'font-display leading-none',
            Tag === 'h1' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl',
            tone === 'primary' ? 'text-cc-green' : 'text-cc-purple-text'
          )}
        >
          {children}
        </Tag>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/**
 * Bloco de seção amplo em roxo com a textura oficial por cima (diretriz da marca).
 * Texto dentro dele deve ser branco.
 */
export function BrandBlock({
  children,
  className,
  texture = true,
}: {
  children: React.ReactNode
  className?: string
  texture?: boolean
}) {
  return (
    <div className={cn('relative isolate overflow-hidden rounded-2xl bg-cc-purple text-white', className)}>
      {texture && (
        <div
          aria-hidden
          className="bg-textura pointer-events-none absolute inset-0 -z-10 opacity-35 mix-blend-luminosity"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-transparent via-transparent to-black/35"
      />
      {children}
    </div>
  )
}
