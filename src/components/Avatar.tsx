import { hueOf, initials } from '../lib/util';
import { db } from '../data/db';
import { hasAura } from '../data/market';
import type { User } from '../data/types';
import { Icon } from './Icons';

export function Avatar({ user, size = 'md', showStatus = false }: { user?: User | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; showStatus?: boolean }) {
  if (!user) return <div className={`avatar avatar-${size} avatar-blank`} aria-hidden="true">?</div>;
  const color = user.accent ?? `hsl(${user.hue || hueOf(user.username)} 40% 42%)`;
  const frame = user.frame ? db.get().listings[user.frame]?.frame : undefined;
  return (
    <span className={`avatar-wrap avatar-wrap-${size} ${frame ? 'avatar-framed' : ''} ${frame?.spin ? '' : 'avatar-frame-static'}`} style={frame ? { '--frame-a': frame.colors[0], '--frame-b': frame.colors[1] ?? frame.colors[0] } as React.CSSProperties : undefined}>
      <span className={`avatar avatar-${size}`} style={{ backgroundColor: user.avatar ? undefined : color }}>
        {user.avatar ? <img src={user.avatar} alt="" /> : initials(user.name)}
      </span>
      {showStatus && <i className={`status-dot status-${user.presence}`} />}
      {hasAura(user.id) && size !== 'xs' && <span className="aura-tiny"><Icon name="spark" size={9} /></span>}
    </span>
  );
}

export function AvatarPile({ people, limit = 3 }: { people: User[]; limit?: number }) {
  return <span className="avatar-pile">{people.slice(0, limit).map((u) => <Avatar key={u.id} user={u} size="xs" />)}{people.length > limit && <span className="avatar-pile-more">+{people.length - limit}</span>}</span>;
}
