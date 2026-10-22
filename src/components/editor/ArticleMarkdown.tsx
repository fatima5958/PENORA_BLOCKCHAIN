import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const ArticleMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <div className="space-y-6 break-words text-[#0A2540] leading-relaxed text-base sm:text-lg">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ node: _node, ...props }) => (
          <h1 {...props} className="font-serif text-3xl sm:text-4xl font-bold text-[#0A2540] tracking-tight mt-8 mb-4 border-b border-[#0A2540]/10 pb-3" />
        ),
        h2: ({ node: _node, ...props }) => (
          <h2 {...props} className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight mt-7 mb-3" />
        ),
        h3: ({ node: _node, ...props }) => (
          <h3 {...props} className="font-serif text-xl sm:text-2xl font-bold text-[#0A2540] mt-6 mb-2" />
        ),
        p: ({ node: _node, ...props }) => (
          <p {...props} className="whitespace-pre-wrap leading-relaxed text-[#1F2937]" />
        ),
        ul: ({ node: _node, ...props }) => (
          <ul {...props} className="list-disc pl-6 space-y-2 text-[#1F2937]" />
        ),
        ol: ({ node: _node, ...props }) => (
          <ol {...props} className="list-decimal pl-6 space-y-2 text-[#1F2937]" />
        ),
        blockquote: ({ node: _node, ...props }) => (
          <blockquote
            {...props}
            className="border-l-4 border-[#00E5F4] bg-[#00E5F4]/5 pl-5 pr-4 py-3 rounded-r-xl italic text-[#4A5B70] my-4"
          />
        ),
        pre: ({ node: _node, ...props }) => (
          <pre
            {...props}
            className="rounded-xl bg-[#06182C] border border-[#00E5F4]/20 text-[#F4F7FA] p-4 sm:p-5 overflow-x-auto text-sm font-mono my-4 shadow-sm"
          />
        ),
        code: ({ node: _node, className, ...props }) => {
          const isInline = !className && !props.children?.toString().includes('\n');
          return isInline ? (
            <code
              {...props}
              className="font-mono text-sm px-1.5 py-0.5 rounded-md bg-[#0A2540]/5 text-[#007C8B] border border-[#0A2540]/10"
            />
          ) : (
            <code {...props} className="font-mono text-sm" />
          );
        },
        a: ({ node: _node, ...props }) => (
          <a
            {...props}
            className="text-[#007C8B] hover:text-[#00E5F4] underline font-medium transition-colors"
            rel="noopener noreferrer"
            target="_blank"
          />
        ),
        img: ({ node: _node, ...props }) =>
          props.src ? (
            <span className="block my-6">
              <img
                {...props}
                className="max-w-full h-auto rounded-2xl shadow-sm border border-[#0A2540]/10 mx-auto"
                loading="lazy"
              />
              {props.alt && (
                <span className="block text-center text-xs text-[#6E7D90] mt-2 italic">
                  {props.alt}
                </span>
              )}
            </span>
          ) : null,
        hr: ({ node: _node, ...props }) => (
          <hr {...props} className="my-8 border-t border-[#0A2540]/15" />
        ),
        del: ({ node: _node, ...props }) => (
          <del {...props} className="line-through text-[#6E7D90]" />
        ),
        table: ({ node: _node, ...props }) => (
          <div className="overflow-x-auto my-6 rounded-xl border border-[#0A2540]/15">
            <table {...props} className="w-full border-collapse text-sm" />
          </div>
        ),
        th: ({ node: _node, ...props }) => (
          <th
            {...props}
            className="border-b border-[#0A2540]/15 p-3.5 text-left bg-[#F4F7FA] font-semibold text-[#0A2540]"
          />
        ),
        td: ({ node: _node, ...props }) => (
          <td {...props} className="border-b border-[#0A2540]/10 p-3.5 text-[#374151]" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
