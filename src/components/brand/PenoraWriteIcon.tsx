import React, { useId } from 'react';

/** A sculpted fountain-pen nib using the official emblem's teal ribbon palette. */
export const PenoraWriteIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`pn-pen-${id}`} x1="14" y1="12" x2="33" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5F4" />
          <stop offset="0.46" stopColor="#007C8B" />
          <stop offset="1" stopColor="#0A2540" />
        </linearGradient>
        <linearGradient id={`pn-pen-fold-${id}`} x1="31" y1="13" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0A2540" />
          <stop offset="1" stopColor="#00B8C8" />
        </linearGradient>
      </defs>
      <g transform="rotate(35 24 24)">
        <path d="M18 5H30V14H18V5Z" fill="#0A2540" />
        <path d="M20 5H24V13H20V5Z" fill="#00E5F4" fillOpacity="0.75" />
        <path d="M17 13H31L35 25L24 42L13 25L17 13Z" fill={`url(#pn-pen-${id})`} />
        <path d="M31 13L35 25L24 42L27 25L31 13Z" fill={`url(#pn-pen-fold-${id})`} />
        <path d="M17 14L14 25L23 39L19 25L21 14H17Z" fill="#9FF8FF" fillOpacity="0.5" />
        <path d="M24 41V25" stroke="#0A2540" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="24" cy="23" r="2.1" fill="#0A2540" />
        <path d="M17 13H31" stroke="#9FF8FF" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <path d="M39 30L40.3 33.7L44 35L40.3 36.3L39 40L37.7 36.3L34 35L37.7 33.7L39 30Z" fill="#00B8C8" />
    </svg>
  );
};
