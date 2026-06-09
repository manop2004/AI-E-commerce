// Renders chat text with inline markdown image support: ![alt](url)
// Splits content into text + image blocks so product images appear inside the bubble.
import { Fragment } from "react";

const IMG_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

export function ChatMessageContent({ content }: { content: string }) {
  if (!content) return null;
  const parts: { type: "text" | "img"; value: string; alt?: string }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((match = IMG_RE.exec(content)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: content.slice(last, match.index) });
    parts.push({ type: "img", value: match[2], alt: match[1] || "product" });
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push({ type: "text", value: content.slice(last) });
  if (parts.length === 0) parts.push({ type: "text", value: content });

  return (
    <div className="space-y-1.5">
      {parts.map((p, i) =>
        p.type === "img" ? (
          <img
            key={i}
            src={p.value}
            alt={p.alt}
            loading="lazy"
            className="block max-w-[220px] w-full rounded-lg border border-border/30 object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <Fragment key={i}>
            <span className="whitespace-pre-wrap break-words">{p.value.trim()}</span>
          </Fragment>
        ),
      )}
    </div>
  );
}