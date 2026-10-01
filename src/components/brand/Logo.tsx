import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Logo oficial (CLASSE CREATOR sobre a faixa roxa). A altura define o tamanho. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.webp"
      alt="Classe Creator"
      width={720}
      height={348}
      priority={priority}
      className={cn('h-10 w-auto select-none', className)}
    />
  )
}
