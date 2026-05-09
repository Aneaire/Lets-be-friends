type BrandLogoProps = {
  className?: string
  variant?: 'mark' | 'lockup'
}

export function BrandLogo({ className = 'h-12 w-auto', variant = 'mark' }: BrandLogoProps) {
  return (
    <img
      src="/logo.svg"
      alt={variant === 'lockup' ? "Let's Be Friends logo" : ''}
      aria-hidden={variant === 'mark' ? true : undefined}
      className={className}
    />
  )
}
