import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function iniciais(nome: string | null | undefined, fallback = 'CC') {
  if (!nome?.trim()) return fallback
  return nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
