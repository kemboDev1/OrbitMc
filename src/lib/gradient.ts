import type { FrameData, MotionSpeed } from '../data/types';

function compactStops(colors: string[]): string[] {
  const out: string[] = [];
  for (const c of colors) {
    const clean = c.trim();
    if (!clean) continue;
    if (!out.length || out[out.length - 1].toLowerCase() !== clean.toLowerCase()) out.push(clean);
  }
  if (!out.length) return ['#ff5b2e', '#8f7dff'];
  if (out.length === 1) return [out[0], out[0] === '#ffffff' ? '#111216' : '#ffffff'];
  return out;
}

export function buildGradientCss(frame?: FrameData | null): string {
  if (!frame || !frame.colors.length) return 'linear-gradient(135deg, #ff5b2e, #8f7dff)';
  const stops = compactStops(frame.colors);
  const motion = frame.motion ?? (frame.spin ? 'spin' : 'none');
  const angle = typeof frame.angle === 'number' && Number.isFinite(frame.angle) ? Math.round(frame.angle) : 135;
  const style = frame.style ?? 'linear';
  if (style === 'conic' || motion === 'spin' || motion === 'shimmer') {
    // Use continuous periodic conic wheel when spinning/shimmering on rings so rotation is unmistakable even for B&W.
    return style === 'radial'
      ? `radial-gradient(circle at 30% 30%, ${stops.join(', ')})`
      : `conic-gradient(from ${angle}deg, ${stops.join(', ')}, ${stops[0]})`;
  }
  if (style === 'radial') return `radial-gradient(circle at 30% 30%, ${stops.join(', ')})`;
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

export function buildBannerFlowCss(frame?: FrameData | null): string {
  if (!frame || !frame.colors.length) return 'linear-gradient(115deg, #1b1536, #bc4e4e)';
  const stops = compactStops(frame.colors);
  const motion = frame.motion ?? (frame.spin ? 'spin' : 'none');
  const angle = typeof frame.angle === 'number' && Number.isFinite(frame.angle) ? Math.round(frame.angle) : 115;
  if (motion === 'none') {
    if (frame.style === 'radial') return `radial-gradient(circle at 30% 30%, ${stops.join(', ')})`;
    return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  }
  // Double-period horizontal track (90deg) aligns identically at 0% and 100% of 200% width for silk-smooth walking flow.
  const rev = [...stops].reverse().slice(1);
  const period = [...stops, ...rev];
  const seamless = [...period, ...period.slice(1)];
  return `linear-gradient(90deg, ${seamless.join(', ')})`;
}

export function frameSpeedDuration(speed?: MotionSpeed): string {
  if (speed === 'fast') return '1.6s';
  if (speed === 'slow') return '5.5s';
  return '3s';
}

export function frameMotionClass(frame?: FrameData | null): string {
  if (!frame) return '';
  const motion = frame.motion ?? (frame.spin ? 'spin' : 'none');
  if (motion === 'spin') return 'avatar-frame-spin';
  if (motion === 'shimmer') return 'avatar-frame-shimmer';
  if (motion === 'pulse') return 'avatar-frame-pulse';
  return '';
}

export const GRADIENT_PRESETS: { name: string; colors: string[]; angle: number; style: 'linear' | 'conic' | 'radial'; motion: 'none' | 'spin' | 'pulse' | 'shimmer' }[] = [
  { name: 'Noir B&W', colors: ['#111216', '#9ca3af', '#ffffff'], angle: 135, style: 'conic', motion: 'spin' },
  { name: 'Cyber Prism', colors: ['#00f5d4', '#3aa8ff', '#8f7dff'], angle: 45, style: 'conic', motion: 'spin' },
  { name: 'Solar Gold', colors: ['#ff5b2e', '#ffb84d', '#ffe08a'], angle: 120, style: 'linear', motion: 'shimmer' },
  { name: 'Rose Nova', colors: ['#ff4d7e', '#8f7dff', '#56ccf2'], angle: 210, style: 'conic', motion: 'spin' },
  { name: 'Emerald Mint', colors: ['#0d9488', '#37d39b', '#a7f3d0'], angle: 160, style: 'linear', motion: 'shimmer' },
];
