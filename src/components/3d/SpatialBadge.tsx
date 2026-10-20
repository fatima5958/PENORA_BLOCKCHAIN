import React from 'react';

interface SpatialBadgeProps {
  children: React.ReactNode;
  variant?: 'coral' | 'ivory' | 'subtle' | 'warning';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const SpatialBadge: React.FC<SpatialBadgeProps> = ({
  children,
  variant = 'subtle',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3.5 py-1.5 gap-2',
  };

  const variantStyles = {
    coral:
      'bg-penora-peach-light/60 text-penora-cocoa border border-penora-peach/40 shadow-spatial-sm',
    ivory:
      'bg-white/80 text-penora-cocoa border border-white/90 shadow-spatial-sm backdrop-blur-sm',
    subtle:
      'bg-penora-cocoa/5 text-penora-cocoa-muted border border-penora-cocoa/10 backdrop-blur-sm',
    warning:
      'bg-amber-100/70 text-amber-900 border border-amber-300/60 shadow-spatial-sm',
  };

  const dotStyles = {
    coral: 'bg-penora-coral animate-pulse',
    ivory: 'bg-penora-cocoa',
    subtle: 'bg-penora-cocoa-muted',
    warning: 'bg-amber-600',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotStyles[variant]}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};
