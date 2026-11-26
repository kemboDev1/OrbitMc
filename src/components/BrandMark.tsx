import { useId } from 'react';

export function BrandMark({ large = false, className = '' }: { large?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const bgId = `obg-${uid}`;
  const orbitId = `oorb-${uid}`;
  const coreId = `ocore-${uid}`;
  return (
    <span className={`brand-mark ${large ? 'brand-mark-large' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none">
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1b1e2e" />
            <stop offset="100%" stopColor="#0c0d14" />
          </linearGradient>
          <linearGradient id={orbitId} x1="8" y1="50" x2="56" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff5b2e" />
            <stop offset="55%" stopColor="#ff944d" />
            <stop offset="100%" stopColor="#8f7dff" />
          </linearGradient>
          <linearGradient id={coreId} x1="20" y1="18" x2="44" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff7a4a" />
            <stop offset="100%" stopColor="#ff4a24" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={`url(#${bgId})`} />
        <rect x="1.5" y="1.5" width="61" height="61" rx="14.5" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" />
        <g transform="rotate(-26 32 32)">
          <path d="M 8 32 A 24 10.5 0 0 1 56 32" stroke={`url(#${orbitId})`} strokeWidth="4.2" strokeLinecap="round" opacity="0.48" />
        </g>
        <path
          d="M 32 18 C 40.284 18 47 24.268 47 32 C 47 39.732 40.284 46 32 46 C 29.52 46 27.18 45.43 25.12 44.43 L 18.8 46.4 L 20.65 40.55 C 18.38 38.24 17 35.26 17 32 C 17 24.268 23.716 18 32 18 Z"
          fill={`url(#${coreId})`}
        />
        <circle cx="26.5" cy="32" r="2.2" fill="#fff7f2" />
        <circle cx="32.5" cy="32" r="2.2" fill="#fff7f2" />
        <circle cx="38.5" cy="32" r="2.2" fill="#fff7f2" />
        <g transform="rotate(-26 32 32)">
          <path d="M 56 32 A 24 10.5 0 0 1 8 32" stroke={`url(#${orbitId})`} strokeWidth="4.5" strokeLinecap="round" />
        </g>
        <circle cx="49" cy="18.5" r="4.2" fill="#8f7dff" stroke="#0f1018" strokeWidth="2" />
      </svg>
    </span>
  );
}
