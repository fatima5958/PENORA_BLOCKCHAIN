// src/components/brand/PenoraLogo.tsx
// Official PENORA Blockchain Logo Suite Component
// Implements Identity Board sections:
//   01 Primary Logo (Stacked)
//   02 Horizontal Logo Lockup
//   03 Icon Only
//   04 Dark Background (Inverse)
//   05 Monochrome Version
//   06 App Icon / Social Avatar
//   07 Favicon / Minimal Variations
import React, { useId } from 'react';

export interface PenoraLogoProps {
  /** Lockup arrangement */
  variant?: 'horizontal' | 'stacked' | 'icon' | 'app-icon' | 'wordmark';
  /** Surface color mode */
  theme?: 'light' | 'dark' | 'mono';
  /** Preset scale */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show the "— BLOCKCHAIN —" sub-lockup */
  showTagline?: boolean;
  /** Additional classes on wrapper */
  className?: string;
}

const ICON_SIZES: Record<NonNullable<PenoraLogoProps['size']>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 88,
};

const WORDMARK_HEIGHTS: Record<NonNullable<PenoraLogoProps['size']>, number> = {
  xs: 15,
  sm: 19,
  md: 23,
  lg: 32,
  xl: 44,
};

/**
 * PENORA Sculptural Ribbon & 4-Point Star Emblem (SVG)
 * Faithfully matches the approved PENORA Blockchain emblem:
 * - Left & right twisting ribbon petals with deep navy inner folds and bright teal crests
 * - Elongated 4-point central star with luminous cyan core
 */
export const PenoraEmblem: React.FC<{
  size?: number;
  theme?: 'light' | 'dark' | 'mono';
  className?: string;
}> = ({ size = 40, theme = 'light', className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const isMono = theme === 'mono';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Outer left ribbon gradient: Dark Teal -> Bright Teal -> Deep Navy base */}
        <linearGradient id={`pn-rib-l-${uid}`} x1="18" y1="12" x2="54" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? '#0A2540' : '#00E5F4'} />
          <stop offset="32%" stopColor={isMono ? '#0A2540' : '#008B9B'} />
          <stop offset="68%" stopColor={isMono ? '#0A2540' : '#0A2540'} />
          <stop offset="100%" stopColor={isMono ? '#0A2540' : '#00E5F4'} />
        </linearGradient>

        {/* Outer right ribbon gradient: Bright Teal crest -> Dark Teal -> Deep Navy */}
        <linearGradient id={`pn-rib-r-${uid}`} x1="64" y1="10" x2="102" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? '#0A2540' : '#009FB0'} />
          <stop offset="38%" stopColor={isMono ? '#0A2540' : '#00E5F4'} />
          <stop offset="76%" stopColor={isMono ? '#0A2540' : '#007C8B'} />
          <stop offset="100%" stopColor={isMono ? '#0A2540' : '#00C8D8'} />
        </linearGradient>

        {/* Inner fold shadow gradient (gives the 3D twist) */}
        <linearGradient id={`pn-fold-${uid}`} x1="30" y1="24" x2="90" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? '#0A2540' : '#06182C'} />
          <stop offset="50%" stopColor={isMono ? '#0A2540' : '#0A2540'} />
          <stop offset="100%" stopColor={isMono ? '#0A2540' : '#005F6B'} />
        </linearGradient>

        {/* Lower ribbon specular sweep */}
        <linearGradient id={`pn-crest-${uid}`} x1="20" y1="54" x2="58" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? '#0A2540' : '#00E5F4'} />
          <stop offset="55%" stopColor={isMono ? '#0A2540' : '#0097A7'} />
          <stop offset="100%" stopColor={isMono ? '#0A2540' : '#006978'} />
        </linearGradient>

        {/* Central 4-point star outer gradient */}
        <linearGradient id={`pn-star-${uid}`} x1="60" y1="24" x2="60" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? '#0A2540' : '#00B8C8'} />
          <stop offset="50%" stopColor={isMono ? '#0A2540' : '#007C8B'} />
          <stop offset="100%" stopColor={isMono ? '#0A2540' : '#0A2540'} />
        </linearGradient>

        {/* Central star core radial glow */}
        <radialGradient id={`pn-core-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isMono ? '#FFFFFF' : '#FFFFFF'} />
          <stop offset="38%" stopColor={isMono ? '#FFFFFF' : '#9FF8FF'} />
          <stop offset="75%" stopColor={isMono ? '#0A2540' : '#00E5F4'} stopOpacity={isMono ? '0' : '0.85'} />
          <stop offset="100%" stopColor="#007C8B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── LEFT SCULPTURAL RIBBON ─────────────────────────────────────── */}
      {/* Inner recessed fold (dark navy/teal depth layer) */}
      <path
        d="M58.5 10C41 25 22 43 22 64C22 81 36 96 56.5 108C44 95 36 79 38 62C40 44 49 28 58.5 10Z"
        fill={`url(#pn-fold-${uid})`}
      />
      {/* Upper-left twisting outer wing */}
      <path
        d="M58.5 8C34 22 16 42 16 64C16 74 20 83 27 91C22 79 25 65 36 53C46 42 54 27 58.5 8Z"
        fill={`url(#pn-rib-l-${uid})`}
      />
      {/* Lower-left luminous cyan ribbon fold */}
      <path
        d="M17.5 58C15 76 28 96 57.5 110C48 97 44 84 46 72C34 68 23 64 17.5 58Z"
        fill={`url(#pn-crest-${uid})`}
      />

      {/* ── RIGHT SCULPTURAL RIBBON ────────────────────────────────────── */}
      {/* Inner recessed fold (dark navy/teal depth layer) */}
      <path
        d="M61.5 10C79 25 98 43 98 64C98 81 84 96 63.5 108C76 95 84 79 82 62C80 44 71 28 61.5 10Z"
        fill={`url(#pn-fold-${uid})`}
      />
      {/* Upper-right luminous cyan ribbon crest */}
      <path
        d="M61.5 8C86 22 104 42 104 64C104 79 95 94 62.5 110C73 96 76 82 74 70C84 62 90 51 84 38C79 27 69 18 61.5 8Z"
        fill={`url(#pn-rib-r-${uid})`}
      />

      {/* ── ELONGATED 4-POINT CENTRAL STAR ─────────────────────────────── */}
      <path
        d="M60 22C61.8 40 64.5 52.5 79 60C64.5 67.5 61.8 80 60 99C58.2 80 55.5 67.5 41 60C55.5 52.5 58.2 40 60 22Z"
        fill={`url(#pn-star-${uid})`}
      />
      {/* Inner bright star facet */}
      <path
        d="M60 32C61 45 63 54 73 60C63 66 61 75 60 88C59 75 57 66 47 60C57 54 59 45 60 32Z"
        fill={`url(#pn-core-${uid})`}
      />
    </svg>
  );
};

/**
 * Custom Geometric PENORA Wordmark (SVG)
 * Matches Identity Board §01, §02, §09:
 * - Custom futuristic P, E, N, O, R, A geometry
 * - Signature bright teal triangle nested inside the 'A'
 * - Optional "— BLOCKCHAIN —" sub-lockup with fading teal rules
 */
export const PenoraWordmark: React.FC<{
  height?: number;
  theme?: 'light' | 'dark' | 'mono';
  showTagline?: boolean;
  className?: string;
}> = ({ height = 24, theme = 'light', showTagline = true, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const textFill = theme === 'dark' ? '#F4F8FB' : '#0A2540';
  const subTextFill = theme === 'dark' ? '#B8D4E3' : '#0A2540';
  const isMono = theme === 'mono';

  // Aspect ratio of wordmark viewBox: 360 x 56 (with tagline) or 360 x 36 (without tagline)
  const vbHeight = showTagline ? 58 : 36;
  const computedWidth = Math.round((height * 360) / vbHeight);

  return (
    <svg
      width={computedWidth}
      height={height}
      viewBox={`0 0 360 ${vbHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 select-none ${className}`}
      role="img"
      aria-label={showTagline ? 'PENORA BLOCKCHAIN' : 'PENORA'}
    >
      <defs>
        {/* Signature Teal Triangle Gradient inside 'A' */}
        <linearGradient id={`pn-tri-${uid}`} x1="334" y1="18" x2="334" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? textFill : '#007C8B'} />
          <stop offset="100%" stopColor={isMono ? textFill : '#00E5F4'} />
        </linearGradient>

        {/* Left rule gradient */}
        <linearGradient id={`pn-rule-l-${uid}`} x1="6" y1="50" x2="88" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? textFill : '#00E5F4'} stopOpacity="0" />
          <stop offset="100%" stopColor={isMono ? textFill : '#00B3C4'} stopOpacity="0.9" />
        </linearGradient>

        {/* Right rule gradient */}
        <linearGradient id={`pn-rule-r-${uid}`} x1="272" y1="50" x2="354" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isMono ? textFill : '#00B3C4'} stopOpacity="0.9" />
          <stop offset="100%" stopColor={isMono ? textFill : '#00E5F4'} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── LETTER P (open geometric bowl + lower stem) ────────────────── */}
      <path
        d="M8 4H39C46.2 4 51 8.5 51 14.5C51 20.5 46.2 25 39 25H16V34H8V18H38C41.2 18 43 16.6 43 14.5C43 12.4 41.2 11 38 11H8V4Z"
        fill={textFill}
      />

      {/* ── LETTER E (rounded top-left geometric E) ────────────────────── */}
      <path
        d="M74 11C74 6.8 77.2 4 81.5 4H112V11H82V15.5H108V22H82V27H113V34H74V11Z"
        fill={textFill}
      />

      {/* ── LETTER N (sharp architectural N) ───────────────────────────── */}
      <path
        d="M134 4H142L168 23.5V4H176V34H168.5L142 14V34H134V4Z"
        fill={textFill}
      />

      {/* ── LETTER O (wide rounded stadium O) ──────────────────────────── */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M208 4H232C240.5 4 246 9.5 246 18V20C246 28.5 240.5 34 232 34H208C199.5 34 194 28.5 194 20V18C194 9.5 199.5 4 208 4ZM209 11C204.5 11 202 13.6 202 18V20C202 24.4 204.5 27 209 27H231C235.5 27 238 24.4 238 20V18C238 13.6 235.5 11 231 11H209Z"
        fill={textFill}
      />

      {/* ── LETTER R (open-stem futuristic R matching board) ───────────── */}
      <path
        d="M264 4H295C302.2 4 307 8.4 307 14.2C307 19.3 303.4 23.2 297.2 24.2L308 34H297.5L287.5 24.5H272V18H294C297.2 18 299 16.5 299 14.2C299 12 297.2 10.8 294 10.8H264V4Z"
        fill={textFill}
      />

      {/* ── LETTER A (chevron apex + glowing teal triangle core) ───────── */}
      <path
        d="M331.2 4H337.8L356 34H347.2L334.5 12.2L321.8 34H313L331.2 4Z"
        fill={textFill}
      />
      {/* Signature Bright Teal Triangle inside 'A' */}
      <path
        d="M334.5 20.5L342.5 34H326.5L334.5 20.5Z"
        fill={`url(#pn-tri-${uid})`}
      />

      {/* ── "— BLOCKCHAIN —" SUB-LOCKUP ────────────────────────────────── */}
      {showTagline && (
        <g>
          <rect x="6" y="49.2" width="80" height="1.5" rx="0.75" fill={`url(#pn-rule-l-${uid})`} />
          <text
            x="180"
            y="53.5"
            textAnchor="middle"
            fill={subTextFill}
            fontFamily="Sora, Inter, sans-serif"
            fontSize="9.5"
            fontWeight="600"
            letterSpacing="6.5"
          >
            BLOCKCHAIN
          </text>
          <rect x="274" y="49.2" width="80" height="1.5" rx="0.75" fill={`url(#pn-rule-r-${uid})`} />
        </g>
      )}
    </svg>
  );
};

export const PenoraLogo: React.FC<PenoraLogoProps> = ({
  variant = 'horizontal',
  theme = 'light',
  size = 'md',
  showTagline = true,
  className = '',
}) => {
  const iconPx = ICON_SIZES[size];
  const wordmarkH = WORDMARK_HEIGHTS[size];

  if (variant === 'icon') {
    return <PenoraEmblem size={iconPx} theme={theme} className={className} />;
  }

  if (variant === 'app-icon') {
    const boxPx = iconPx + 12;
    return (
      <div
        style={{ width: boxPx, height: boxPx }}
        className={`relative inline-flex items-center justify-center rounded-[24%] bg-gradient-to-br from-[#0F2E4F] via-[#0A2540] to-[#06182C] border border-[#00E5F4]/25 shadow-[0_8px_24px_-6px_rgba(0,124,139,0.45)] flex-shrink-0 ${className}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-1 rounded-[20%] opacity-45"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(0, 229, 244, 0.35), transparent 70%)',
          }}
        />
        <PenoraEmblem size={Math.round(iconPx * 0.82)} theme="dark" />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <PenoraWordmark
        height={wordmarkH}
        theme={theme}
        showTagline={showTagline}
        className={className}
      />
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center gap-2.5 ${className}`}>
        <PenoraEmblem size={Math.round(iconPx * 1.35)} theme={theme} />
        <PenoraWordmark
          height={wordmarkH}
          theme={theme}
          showTagline={showTagline}
        />
      </div>
    );
  }

  // Default: Horizontal lockup (Identity Board §02)
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <PenoraEmblem size={iconPx} theme={theme} />
      <PenoraWordmark
        height={showTagline ? wordmarkH + 6 : wordmarkH}
        theme={theme}
        showTagline={showTagline}
      />
    </div>
  );
};
