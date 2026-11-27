import { Crown, Sparkles } from 'lucide-react';
import { hueOf, initials } from '../lib/util';
import { buildGradientCss, frameMotionClass, frameSpeedDuration } from '../lib/gradient';
import { db } from '../data/db';
import { hasAura } from '../data/market';
import type { User } from '../data/types';

export function Avatar({ user, size = 'md', showStatus = false }: { user?: User | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; showStatus?: boolean }) {
  if (!user) return <div className={`avatar avatar-${size} avatar-blank`} aria-hidden="true">?</div>;
  const color = user.accent ?? `hsl(${user.hue || hueOf(user.username)} 46% 44%)`;
  const frame = user.frame ? db.get().listings[user.frame]?.frame : undefined;
  const isMax = hasAura(user.id) && user.aura?.tier === 'nova';
  const motionClass = frameMotionClass(frame);
  const hasCustomStroke = !frame && !!user.profileStroke;
  const avatarStyle = {
    ...(frame
      ? {
        '--frame-a': frame.colors[0],
        '--frame-b': frame.colors[1] ?? frame.colors[0],
        '--frame-grad': buildGradientCss(frame),
        '--frame-speed': frameSpeedDuration(frame.speed),
      }
      : {}),
    ...(hasCustomStroke ? { '--profile-stroke': user.profileStroke } : {}),
  } as React.CSSProperties;
  return (
    <span className={`avatar-wrap avatar-wrap-${size} ${hasCustomStroke ? 'avatar-has-stroke' : ''} ${frame ? 'avatar-framed' : ''} ${motionClass}`} style={avatarStyle}>
      <span className={`avatar avatar-${size}`} style={{ backgroundColor: user.avatar ? undefined : color }}>
        {user.avatar ? <img src={user.avatar} alt="" loading="lazy" decoding="async" /> : initials(user.name)}
      </span>
      {showStatus && <i className={`status-dot status-${user.presence}`} />}
      {hasAura(user.id) && size !== 'xs' && (
        <span className={`aura-tiny ${isMax ? 'is-max' : ''}`}>
          {isMax ? <Crown size={9} strokeWidth={2.4} /> : <Sparkles size={9} strokeWidth={2.4} />}
        </span>
      )}
    </span>
  );
}

export function AvatarPile({ people, limit = 3 }: { people: User[]; limit?: number }) {
  return <span className="avatar-pile">{people.slice(0, limit).map((u) => <Avatar key={u.id} user={u} size="xs" />)}{people.length > limit && <span className="avatar-pile-more">+{people.length - limit}</span>}</span>;
}
