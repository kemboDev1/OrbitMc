import { useId } from 'react';

export function BrandMark({ large = false, className = '' }: { large?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const bgId = `obg-${uid}`;
  const portalId = `oport-${uid}`;
  const arcId = `oarc-${uid}`;
  return (
    <span className={`brand-mark ${large ? 'brand-mark-large' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none">
        <defs>
          <linearGradient id={bgId} x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1b2136" />
            <stop offset="55%" stopColor="#111524" />
            <stop offset="100%" stopColor="#090b12" />
          </linearGradient>
          <linearGradient id={portalId} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff6838" />
            <stop offset="55%" stopColor="#ff9a52" />
            <stop offset="100%" stopColor="#947dff" />
          </linearGradient>
          <linearGradient id={arcId} x1="6" y1="46" x2="58" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff5b2e" />
            <stop offset="50%" stopColor="#ffbe6b" />
            <stop offset="100%" stopColor="#56ccf2" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="17" fill={`url(#${bgId})`} />
        <rect x="1.5" y="1.5" width="61" height="61" rx="15.5" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.5" />
        {/* Back orbital sweep */}
        <g transform="rotate(-24 32 32)">
          <path d="M 9 32 A 23 9.5 0 0 1 55 32" stroke={`url(#${arcId})`} strokeWidth="3.6" strokeLinecap="round" opacity="0.4" />
        </g>
        {/* Outer Orbit Ring */}
        <circle cx="32" cy="32" r="14.5" stroke={`url(#${portalId})`} strokeWidth="5.2" />
        {/* Core 4-point faceted spark */}
        <path
          d="M 32 23.5 C 32.9 28.4 35.6 31.1 40.5 32 C 35.6 32.9 32.9 35.6 32 40.5 C 31.1 35.6 28.4 32.9 23.5 32 C 28.4 31.1 31.1 28.4 32 23.5 Z"
          fill="#fff7ef"
        />
        {/* Front orbital sweep */}
        <g transform="rotate(-24 32 32)">
          <path d="M 55 32 A 23 9.5 0 0 1 9 32" stroke={`url(#${arcId})`} strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* Orbiting satellite orb */}
        <circle cx="51" cy="19" r="4.3" fill="#56ccf2" stroke="#0c0f1a" strokeWidth="2" />
      </svg>
    </span>
  );
}
