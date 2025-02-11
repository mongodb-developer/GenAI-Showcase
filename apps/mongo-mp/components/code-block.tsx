'use client'

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  return (
    <pre className="mt-2 rounded-md bg-slate-900 p-4 overflow-x-auto">
      <code className="text-sm text-slate-50 font-mono text-left whitespace-pre">
        {code}
      </code>
    </pre>
  );
}
