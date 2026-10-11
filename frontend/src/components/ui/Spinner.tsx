import React from 'react';
import clsx from 'clsx';

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, color = 'currentColor' }) => {
  const sizeClasses = {
    xs: 'w-3 h-3 border-[2px]',
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block animate-spin rounded-full border-solid border-t-transparent',
        sizeClasses[size],
        className
      )}
      style={{ borderColor: `${color} transparent transparent transparent` }}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
