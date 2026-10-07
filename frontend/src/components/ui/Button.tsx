import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles'
import { Spinner } from './Spinner'

export type { ButtonSize, ButtonVariant }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner label="Working" /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}
