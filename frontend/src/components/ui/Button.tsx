import React, { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary:
        'bg-blue-primary text-white hover:bg-[#0759af] active:bg-[#064c95] focus:ring-blue-primary shadow-sm',
      secondary:
        'bg-white text-navy border border-border hover:bg-slate-50 active:bg-slate-100 focus:ring-navy shadow-xs',
      ghost:
        'bg-transparent text-navy hover:bg-blue-light/50 active:bg-blue-light focus:ring-blue-primary',
      danger:
        'bg-error text-white hover:bg-[#9f1818] active:bg-[#861414] focus:ring-error shadow-sm',
    };

    const sizeClasses = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading && <Spinner size={size === 'lg' ? 'md' : 'sm'} color="currentColor" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
