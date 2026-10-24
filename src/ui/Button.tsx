import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'wood' | 'primary' | 'ghost' | 'text'
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  iconRight?: IconName
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'wood', size = 'md', icon, iconRight, children, className = '', type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={`fv-button fv-button--${variant} fv-button--${size} ${className}`} {...rest}><span className="fv-button__content">{icon && <Icon name={icon} compact/>}<span>{children}</span>{iconRight && <Icon name={iconRight} compact/>}</span></button>
})
export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children'> { icon: IconName; label: string }
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, label, className = '', ...rest }, ref) {
  return <Button ref={ref} icon={icon} aria-label={label} title={label} className={`fv-icon-button ${className}`} {...rest}/>
})
