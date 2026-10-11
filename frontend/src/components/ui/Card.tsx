import React, { HTMLAttributes } from 'react';
import clsx from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  footer,
  padding = 'md',
  className,
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };

  return (
    <div
      className={clsx(
        'bg-card-bg border border-border rounded-lg shadow-subtle overflow-hidden',
        className
      )}
      {...props}
    >
      {(title || subtitle || headerActions) && (
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 bg-slate-50/50">
          <div>
            {title && <h3 className="text-base font-semibold text-navy tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-border bg-slate-50/50 flex items-center justify-end gap-3">
          {footer}
        </div>
      )}
    </div>
  );
};
