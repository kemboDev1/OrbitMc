import type { FrameData, MotionSpeed } from '../data/types';

export function buildGradientCss(frame?: FrameData | null): string {
  if (!frame || !frame.colors.length) return 'linear-gradient(135deg, #ff5b2e, #8f7dff)';
  const stops = frame.colors.length === 1 ? [frame.colors[0], frame.colors[0]] : frame.colors;
  const joined = stops.join(', ');
  const angle = typeof frame.angle === 'number' && Number.isFinite(frame.angle) ? Math.round(frame.angle) : 135;
  const style = frame.style ?? 'linear';
  if (style === 'conic') return `conic-gradient(from ${angle}deg, ${joined}, ${stops[0]})`;
  if (style === 'radial') return `radial-gradient(circle at 30% 30%, ${joined})`;
  return `linear-gradient(${angle}deg, ${joined})`;
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
  { name: 'Noir B&W', colors: ['#111216', '#9ca3af', '#ffffff'], angle: 135, style: 'linear', motion: 'shimmer' },
  { name: 'Cyber Prism', colors: ['#00f5d4', '#3aa8ff', '#8f7dff'], angle: 45, style: 'conic', motion: 'spin' },
  { name: 'Solar Gold', colors: ['#ff5b2e', '#ffb84d', '#ffe08a'], angle: 120, style: 'linear', motion: 'pulse' },
  { name: 'Rose Nova', colors: ['#ff4d7e', '#8f7dff', '#56ccf2'], angle: 210, style: 'conic', motion: 'spin' },
  { name: 'Emerald Mint', colors: ['#0d9488', '#37d39b', '#a7f3d0'], angle: 160, style: 'linear', motion: 'shimmer' },
];
