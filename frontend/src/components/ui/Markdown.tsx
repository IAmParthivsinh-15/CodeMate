import ReactMarkdown from 'react-markdown'
import { cn } from '../../utils/cn'

/** Renders AI answers (Markdown). Raw HTML in the source is not rendered. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-cm text-sm', className)}>
      <ReactMarkdown
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
