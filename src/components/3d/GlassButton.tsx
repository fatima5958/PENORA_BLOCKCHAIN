import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'cocoa';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  href?: string;
  className?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'right',
  href,
  className = '',
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium transition-all duration-300 rounded-full focus:outline-none focus:ring-2 focus:ring-penora-coral/40 active:scale-[0.98] select-none';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-7 py-3.5 gap-2.5 font-semibold',
  };

  const variantStyles = {
    primary:
      'bg-penora-coral text-white shadow-gloss-button hover:bg-penora-coral-hover border border-white/30 hover:shadow-[0_8px_25px_-4px_rgba(201,110,75,0.45)]',
    secondary:
      'liquid-glass text-penora-cocoa hover:text-penora-cocoa-dark hover:bg-white/95 border border-white/80 shadow-spatial-sm hover:shadow-spatial-md',
    glass:
      'bg-white/60 text-penora-cocoa backdrop-blur-md border border-white/70 hover:bg-white/85 shadow-spatial-sm hover:shadow-spatial-md',
    cocoa:
      'bg-penora-cocoa text-penora-cream shadow-gloss-dark hover:bg-penora-cocoa-dark border border-white/10 hover:shadow-spatial-lg',
  };

  const content = (
    <>
      {/* Specular gloss highlight on top half of button */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-0 h-[45%] rounded-t-full bg-gradient-to-b from-white/35 to-transparent opacity-90"
      />
      {icon && iconPosition === 'left' && <span className="relative z-10 transition-transform group-hover:-translate-x-0.5">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {icon && iconPosition === 'right' && <span className="relative z-10 transition-transform group-hover:translate-x-0.5">{icon}</span>}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`group ${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={`group ${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {content}
    </button>
  );
};
