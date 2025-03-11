import type React from "react"
import ReactMarkdown from "react-markdown"

export const Markdown = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: string }) => {
  return (
    <div className={className} {...props}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}

