import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: Props) {
  if (!content.trim()) {
    return <span className="text-[var(--text-muted)] italic text-sm">No content</span>
  }
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, {
          trust: true,
          strict: false,           // don't throw on unknown commands
          output: 'htmlAndMathml', // best browser compatibility
        }]]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 text-[var(--text-secondary)] text-sm leading-relaxed">{children}</p>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-')
            return isBlock
              ? <code className={`${className} block`}>{children}</code>
              : <code className="font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-[0.85em]">{children}</code>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}