import React, { useState, useRef } from 'react';

interface FloatingCardProps {
  children: React.ReactNode;
  className?: string;
  depth?: 'sm' | 'md' | 'lg' | 'hero';
  glowColor?: 'coral' | 'ivory' | 'subtle';
  interactiveTilt?: boolean;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({
  children,
  className = '',
  depth = 'md',
  glowColor = 'coral',
  interactiveTilt = true,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const depthClasses = {
    sm: 'shadow-spatial-sm border border-white/60 hover:shadow-spatial-md',
    md: 'shadow-spatial-md border border-white/70 hover:shadow-spatial-lg',
    lg: 'shadow-spatial-lg border border-white/80 hover:shadow-spatial-xl',
    hero: 'shadow-spatial-xl border border-white/90 hover:shadow-spatial-float',
  };

  const glowStyles = {
    coral: 'hover:shadow-[0_24px_60px_-12px_rgba(201,110,75,0.25)]',
    ivory: 'hover:shadow-[0_24px_60px_-12px_rgba(74,49,43,0.12)]',
    subtle: 'hover:shadow-[0_20px_45px_-10px_rgba(74,49,43,0.08)]',
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate normalized rotation (-1 to 1)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const normX = (x - centerX) / centerX;
    const normY = (y - centerY) / centerY;

    const maxRotation = depth === 'hero' ? 6 : 4;
    setRotateX(-normY * maxRotation);
    setRotateY(normX * maxRotation);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.18,
    });
  };

  const handleMouseLeave = () => {
    if (!interactiveTilt) return;
    setRotateX(0);
    setRotateY(0);
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: interactiveTilt
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`
          : undefined,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
      }}
      className={`relative overflow-hidden rounded-3xl bg-penora-surface/90 backdrop-blur-md transition-all duration-300 ${depthClasses[depth]} ${glowStyles[glowColor]} ${className}`}
    >
      {/* Specular Liquid Glare Simulation */}
      {interactiveTilt && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-3xl transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 350px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 70%)`,
            opacity: glarePos.opacity,
          }}
        />
      )}

      {/* Internal Content */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
