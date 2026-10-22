export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'heading'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'code'
  | 'inline-code'
  | 'list'
  | 'ordered-list'
  | 'divider'
  | 'link'
  | 'image';

export function formatMarkdown(value: string, start: number, end: number, action: MarkdownAction) {
  const selection = value.slice(start, end);

  // Line-prefix actions (toggleable across full lines)
  if (
    action === 'heading' ||
    action === 'h1' ||
    action === 'h2' ||
    action === 'h3' ||
    action === 'quote' ||
    action === 'list' ||
    action === 'ordered-list'
  ) {
    const from = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
    const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const nextNewline = value.indexOf('\n', last);
    const to = nextNewline < 0 ? value.length : nextNewline;

    let prefix = '## ';
    if (action === 'h1') prefix = '# ';
    else if (action === 'h2' || action === 'heading') prefix = '## ';
    else if (action === 'h3') prefix = '### ';
    else if (action === 'quote') prefix = '> ';
    else if (action === 'list') prefix = '- ';
    else if (action === 'ordered-list') prefix = '1. ';

    const lines = value.slice(from, to).split('\n');
    const remove = lines.every(line => line.startsWith(prefix));
    const text = lines.map(line => (remove ? line.slice(prefix.length) : prefix + line)).join('\n');
    return { text: value.slice(0, from) + text + value.slice(to), start: from, end: from + text.length };
  }

  // Divider
  if (action === 'divider') {
    const prevNewline = start === 0 || value[start - 1] === '\n' ? '' : '\n';
    const nextNewline = end === value.length || value[end] === '\n' ? '' : '\n';
    const dividerText = `${prevNewline}\n---\n\n${nextNewline}`;
    return {
      text: value.slice(0, start) + dividerText + value.slice(end),
      start: start + dividerText.length,
      end: start + dividerText.length,
    };
  }

  // Link
  if (action === 'link') {
    const linkText = selection || 'link text';
    const linkFormatted = `[${linkText}](https://)`;
    return {
      text: value.slice(0, start) + linkFormatted + value.slice(end),
      start: start + 1,
      end: start + 1 + linkText.length,
    };
  }

  // Image insertion
  if (action === 'image') {
    const altText = selection || 'Image description';
    const imageFormatted = `![${altText}](https://)`;
    return {
      text: value.slice(0, start) + imageFormatted + value.slice(end),
      start: start + 2,
      end: start + 2 + altText.length,
    };
  }

  // Inline Code
  if (action === 'inline-code') {
    const inner = selection || 'code';
    return {
      text: value.slice(0, start) + '`' + inner + '`' + value.slice(end),
      start: start + 1,
      end: start + 1 + inner.length,
    };
  }

  // Fenced Code Block
  if (action === 'code') {
    const prefix = `${start && value[start - 1] !== '\n' ? '\n' : ''}\`\`\`\n`;
    const suffix = `\n\`\`\`${end < value.length && value[end] !== '\n' ? '\n' : ''}`;
    const inner = selection || 'code';
    return {
      text: value.slice(0, start) + prefix + inner + suffix + value.slice(end),
      start: start + prefix.length,
      end: start + prefix.length + inner.length,
    };
  }

  // Strikethrough
  if (action === 'strikethrough') {
    const inner = selection || 'strikethrough text';
    return {
      text: value.slice(0, start) + '~~' + inner + '~~' + value.slice(end),
      start: start + 2,
      end: start + 2 + inner.length,
    };
  }

  // Bold or Italic
  const marker = action === 'bold' ? '**' : '*';
  const inner = selection || (action === 'bold' ? 'bold text' : 'italic text');
  return {
    text: value.slice(0, start) + marker + inner + marker + value.slice(end),
    start: start + marker.length,
    end: start + marker.length + inner.length,
  };
}

export function articleSlug(title: string): string {
  return (
    title
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || `essay-${crypto.randomUUID().slice(0, 8)}`
  );
}

export function normalizeTags(input: string): string[] {
  return [...new Set(input.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
}

export function isValidCoverUrl(value: string): boolean {
  if (!value.trim()) return true;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(value)) return true;
  try {
    return ['https:', 'http:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}
