import {
  Rocket, Crown, Zap, Gem, Flame, Star, Orbit, Heart, ShieldCheck,
  Sparkles, Music, Code2, Trophy, Compass, Globe, Terminal, Layers, Users, MessageSquare,
} from 'lucide-react';
import type { CSSProperties } from 'react';

export interface VectorBadgeDef {
  id: string;
  label: string;
  bg: string;
  fg: string;
  Icon: typeof Rocket;
}

export const VECTOR_BADGES: VectorBadgeDef[] = [
  { id: 'badge:rocket', label: 'Launch', bg: 'linear-gradient(135deg, #ff5b2e, #ff944d)', fg: '#fff8f2', Icon: Rocket },
  { id: 'badge:crown', label: 'Royal', bg: 'linear-gradient(135deg, #f5b942, #e07a24)', fg: '#1c1205', Icon: Crown },
  { id: 'badge:bolt', label: 'Turbo', bg: 'linear-gradient(135deg, #ffd43b, #ff8a00)', fg: '#1a1204', Icon: Zap },
  { id: 'badge:diamond', label: 'Nova', bg: 'linear-gradient(135deg, #56ccf2, #8f7dff)', fg: '#ffffff', Icon: Gem },
  { id: 'badge:flame', label: 'Hot', bg: 'linear-gradient(135deg, #ff416c, #ff4b2b)', fg: '#fff7f5', Icon: Flame },
  { id: 'badge:star', label: 'Star', bg: 'linear-gradient(135deg, #9b6dff, #ec6ead)', fg: '#ffffff', Icon: Star },
  { id: 'badge:planet', label: 'Orbit', bg: 'linear-gradient(135deg, #2193b0, #6dd5ed)', fg: '#071b22', Icon: Orbit },
  { id: 'badge:heart', label: 'Love', bg: 'linear-gradient(135deg, #ff4d7e, #ff7eb3)', fg: '#ffffff', Icon: Heart },
  { id: 'badge:shield', label: 'Guard', bg: 'linear-gradient(135deg, #16a085, #37d39b)', fg: '#061a14', Icon: ShieldCheck },
  { id: 'badge:sparkles', label: 'Aura', bg: 'linear-gradient(135deg, #8f7dff, #3aa8ff)', fg: '#ffffff', Icon: Sparkles },
  { id: 'badge:music', label: 'Vibe', bg: 'linear-gradient(135deg, #e95f87, #8f7dff)', fg: '#ffffff', Icon: Music },
  { id: 'badge:code', label: 'Dev', bg: 'linear-gradient(135deg, #2b3248, #4b5678)', fg: '#92f2d0', Icon: Code2 },
  { id: 'badge:trophy', label: 'Win', bg: 'linear-gradient(135deg, #f7971e, #ffd200)', fg: '#1f1402', Icon: Trophy },
  { id: 'badge:compass', label: 'Explore', bg: 'linear-gradient(135deg, #3aa8ff, #37d39b)', fg: '#071920', Icon: Compass },
];

export const HUB_ICON_OPTIONS: { key: string; label: string; Icon: typeof Rocket }[] = [
  { key: 'icon:orbit', label: 'Orbit', Icon: Orbit },
  { key: 'icon:rocket', label: 'Team', Icon: Rocket },
  { key: 'icon:sparkles', label: 'Studio', Icon: Sparkles },
  { key: 'icon:globe', label: 'Community', Icon: Globe },
  { key: 'icon:code', label: 'Builders', Icon: Code2 },
  { key: 'icon:terminal', label: 'Systems', Icon: Terminal },
  { key: 'icon:music', label: 'Music', Icon: Music },
  { key: 'icon:flame', label: 'Hot', Icon: Flame },
  { key: 'icon:shield', label: 'Ops', Icon: ShieldCheck },
  { key: 'icon:layers', label: 'Design', Icon: Layers },
  { key: 'icon:users', label: 'Friends', Icon: Users },
  { key: 'icon:chat', label: 'Chat', Icon: MessageSquare },
];

export function VectorBadge({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const found = VECTOR_BADGES.find((b) => b.id === id);
  if (!found) return <span className="vector-emoji-fallback">{id}</span>;
  const { Icon, bg, fg, label } = found;
  const px = size === 'lg' ? 24 : size === 'sm' ? 14 : 18;
  return (
    <span className={`vector-badge vector-badge-${size}`} style={{ background: bg, color: fg } as CSSProperties} title={label}>
      <Icon size={px} strokeWidth={2.2} />
    </span>
  );
}

export function HubSymbol({ mark, size = 18 }: { mark: string; size?: number }) {
  const found = HUB_ICON_OPTIONS.find((item) => item.key === mark);
  if (found) {
    const { Icon } = found;
    return <Icon size={size} strokeWidth={2} />;
  }
  return <span>{mark || '✳'}</span>;
}
