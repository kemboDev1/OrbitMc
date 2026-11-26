import { useState, type ReactNode } from 'react';

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
