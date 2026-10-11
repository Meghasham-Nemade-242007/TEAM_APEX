import React from 'react';
import clsx from 'clsx';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className,
}) => {
  const configs = {
    info: {
      container: 'bg-blue-light/60 border-blue-200 text-navy',
      icon: <Info className="w-5 h-5 text-blue-primary shrink-0" />,
      titleColor: 'text-blue-primary',
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      icon: <CheckCircle2 className="w-5 h-5 text-success shrink-0" />,
      titleColor: 'text-success',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-950',
      icon: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
      titleColor: 'text-warning',
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-950',
      icon: <AlertCircle className="w-5 h-5 text-error shrink-0" />,
      titleColor: 'text-error',
    },
  };

  const { container, icon, titleColor } = configs[variant];

  return (
    <div
      role="alert"
      className={clsx(
        'border rounded-lg p-3.5 flex items-start gap-3 text-sm transition-all shadow-xs',
        container,
        className
      )}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        {title && <h4 className={clsx('font-semibold text-sm mb-0.5', titleColor)}>{title}</h4>}
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-text-secondary hover:text-text-main p-1 rounded transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
