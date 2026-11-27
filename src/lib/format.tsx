import { useState, type ReactNode } from 'react';
import { Play, Video } from 'lucide-react';

function SpoilerSpan({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      className={`msg-spoiler ${revealed ? 'revealed' : ''}`}
      onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed((v) => !v); } }}
      title={revealed ? undefined : 'Click to reveal spoiler'}
    >
      {text}
    </span>
  );
}

const YT_RE = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s<]*)/gi;

export function extractYouTubeIds(text: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  YT_RE.lastIndex = 0;
  while ((match = YT_RE.exec(text)) !== null) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids].slice(0, 2);
}

export function YouTubeEmbedCard({ videoId }: { videoId: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="yt-embed-card" onClick={(e) => e.stopPropagation()}>
      <div className="yt-embed-head">
        <Video size={14} />
        <span>YouTube</span>
        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">
          youtu.be/{videoId}
        </a>
      </div>
      <div className="yt-embed-stage">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={`YouTube video ${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="yt-thumb-btn" onClick={() => setPlaying(true)} aria-label="Play YouTube video">
            <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="YouTube thumbnail" loading="lazy" />
            <span className="yt-play-circle"><Play size={22} fill="currentColor" /></span>
          </button>
        )}
      </div>
    </div>
  );
}

const TOKEN_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\|\|[^|\n]+\|\||https?:\/\/[^\s<]+|@[a-z0-9_]{2,20})/gi;

export function renderRichText(text: string): ReactNode[] {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  const out: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    if (block.startsWith('```') && block.endsWith('```') && block.length >= 6) {
      const code = block.slice(3, -3).replace(/^\n/, '');
      out.push(<pre key={`cb-${bi}`} className="msg-codeblock"><code>{code}</code></pre>);
      return;
    }
    const parts = block.split(TOKEN_RE);
    parts.forEach((part, pi) => {
      if (!part) return;
      const key = `${bi}-${pi}`;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
      } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        out.push(<em key={key}>{part.slice(1, -1)}</em>);
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        out.push(<code key={key} className="msg-inline-code">{part.slice(1, -1)}</code>);
      } else if (part.startsWith('||') && part.endsWith('||') && part.length > 4) {
        out.push(<SpoilerSpan key={key} text={part.slice(2, -2)} />);
      } else if (/^https?:\/\//i.test(part)) {
        out.push(
          <a key={key} className="msg-link" href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {part}
          </a>,
        );
      } else if (part.startsWith('@')) {
        out.push(<span key={key} className="msg-mention">{part}</span>);
      } else {
        out.push(part);
      }
    });
  });
  return out;
}
