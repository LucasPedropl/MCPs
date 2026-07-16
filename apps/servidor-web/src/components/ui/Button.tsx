import React, { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'relative inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:scale-100',
          variant === 'primary' &&
            'bg-accent text-accent-fg hover:opacity-90 border border-transparent shadow-sm',
          variant === 'secondary' &&
            'bg-elevated hover:bg-elevated/80 text-ink border border-subtle',
          variant === 'danger' &&
            'bg-danger/10 hover:bg-danger/15 text-danger border border-danger/30',
          variant === 'ghost' &&
            'bg-transparent hover:bg-elevated text-ink-muted hover:text-ink border border-transparent',
          size === 'sm' && 'text-xs px-3 py-1.5 gap-1.5 min-h-9',
          size === 'md' && 'text-sm px-4 py-2 gap-2 min-h-11',
          size === 'lg' && 'text-base px-6 py-3 gap-2.5 min-h-12',
          className,
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
