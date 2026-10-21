export type MarkdownAction = 'bold' | 'italic' | 'heading' | 'quote' | 'code' | 'list';

export function formatMarkdown(value: string, start: number, end: number, action: MarkdownAction) {
  const selection = value.slice(start, end);
  if (action === 'heading' || action === 'quote' || action === 'list') {
    const from = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
    const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const nextNewline = value.indexOf('\n', last);
    const to = nextNewline < 0 ? value.length : nextNewline;
    const prefix = action === 'heading' ? '## ' : action === 'quote' ? '> ' : '- ';
    const lines = value.slice(from, to).split('\n');
    const remove = lines.every(line => line.startsWith(prefix));
    const text = lines.map(line => remove ? line.slice(prefix.length) : prefix + line).join('\n');
    return { text: value.slice(0, from) + text + value.slice(to), start: from, end: from + text.length };
  }
  const marker = action === 'bold' ? '**' : action === 'italic' ? '*' : '```';
  const prefix = action === 'code' ? `${start && value[start - 1] !== '\n' ? '\n' : ''}\`\`\`\n` : marker;
  const suffix = action === 'code' ? `\n\`\`\`${end < value.length && value[end] !== '\n' ? '\n' : ''}` : marker;
  const inner = selection || (action === 'code' ? 'code' : action === 'bold' ? 'bold text' : 'italic text');
  return {
    text: value.slice(0, start) + prefix + inner + suffix + value.slice(end),
    start: start + prefix.length,
    end: start + prefix.length + inner.length,
  };
}

export function articleSlug(title: string): string {
  return title.normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
    || `essay-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeTags(input: string): string[] {
  return [...new Set(input.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
}

export function isValidCoverUrl(value: string): boolean {
  if (!value.trim()) return true;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(value)) return true;
  try {
    return ['https:', 'http:'].includes(new URL(value.trim()).protocol);
  } catch { return false; }
}
