import React, { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-panel border border-subtle rounded-md px-4 py-2.5 text-sm text-ink',
            'placeholder:text-ink-muted/70',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30',
            'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
            icon && 'pl-10',
            error &&
              'border-danger focus:border-danger focus:ring-danger/30',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-danger font-medium pl-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
