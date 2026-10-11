import React from 'react';
import clsx from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}) => {
  const variantClasses = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-blue-light text-blue-primary border-blue-200',
    success: 'bg-emerald-50 text-success border-emerald-200',
    warning: 'bg-amber-50 text-warning border-amber-200',
    error: 'bg-red-50 text-error border-red-200',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border leading-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
