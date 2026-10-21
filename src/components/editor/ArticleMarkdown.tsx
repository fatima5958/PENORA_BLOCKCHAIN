import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const ArticleMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <div className="space-y-5 break-words text-[#0A2540] leading-relaxed">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ node: _node, ...props }) => <h1 {...props} className="font-display text-3xl font-bold" />,
        h2: ({ node: _node, ...props }) => <h2 {...props} className="font-display text-2xl font-bold mt-7" />,
        h3: ({ node: _node, ...props }) => <h3 {...props} className="font-display text-xl font-bold mt-6" />,
        p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap" />,
        ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-6 space-y-2" />,
        ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-6 space-y-2" />,
        blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l-4 border-[#007C8B] pl-5 italic text-[#4A5B70]" />,
        pre: ({ node: _node, ...props }) => <pre {...props} className="rounded-xl bg-[#0A2540] text-[#F4F7FA] p-4 overflow-x-auto text-sm" />,
        code: ({ node: _node, ...props }) => <code {...props} className="font-mono text-sm" />,
        a: ({ node: _node, ...props }) => <a {...props} className="text-[#007C8B] underline" rel="noopener noreferrer" />,
        img: ({ node: _node, ...props }) => props.src ? <img {...props} className="max-w-full h-auto rounded-xl" loading="lazy" /> : null,
        table: ({ node: _node, ...props }) => <div className="overflow-x-auto"><table {...props} className="w-full border-collapse text-sm" /></div>,
        th: ({ node: _node, ...props }) => <th {...props} className="border border-[#0A2540]/15 p-3 text-left bg-[#F4F7FA]" />,
        td: ({ node: _node, ...props }) => <td {...props} className="border border-[#0A2540]/15 p-3" />,
      }}
    >{content}</ReactMarkdown>
  </div>
);
