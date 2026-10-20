import React from 'react';
import { Award, ShieldCheck, HelpCircle } from 'lucide-react';

interface ReputationIndicatorProps {
  score: number;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ReputationIndicator: React.FC<ReputationIndicatorProps> = ({
  score,
  showTooltip = true,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3.5 py-1.5 gap-2 font-semibold',
  };

  const getTier = (score: number) => {
    if (score >= 90) return { label: 'Distinguished Curator', color: 'text-penora-coral' };
    if (score >= 80) return { label: 'Senior Contributor', color: 'text-amber-700' };
    if (score >= 60) return { label: 'Active Author', color: 'text-penora-cocoa' };
    return { label: 'New Contributor', color: 'text-penora-cocoa-muted' };
  };

  const tier = getTier(score);

  return (
    <div className={`group relative inline-flex items-center ${className}`}>
      <div
        className={`inline-flex items-center rounded-full bg-penora-peach-light/40 border border-penora-peach/30 text-penora-cocoa shadow-spatial-sm ${sizeClasses[size]}`}
      >
        <Award className="h-3.5 w-3.5 text-penora-coral" />
        <span className="font-semibold tracking-tight">{score}</span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-penora-coral opacity-80">
          Rep
        </span>
      </div>

      {showTooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-56 rounded-2xl bg-penora-cocoa-dark p-3 text-xs text-penora-cream shadow-spatial-xl group-hover:block z-50 transition-all border border-white/10"
        >
          <div className="flex items-center gap-1.5 font-semibold text-penora-peach mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-penora-coral" />
            <span>{tier.label} ({score}/100)</span>
          </div>
          <p className="text-[11px] text-penora-ivory/80 leading-relaxed">
            Non-cash reputation points earned via peer citations and editorial quality. Not redeemable for currency.
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-penora-cocoa-dark" />
        </div>
      )}
    </div>
  );
};
