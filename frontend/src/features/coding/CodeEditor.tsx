import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import { useTheme } from '../../app/themeContext'
import type { CodeLanguage } from '../../types/api'
import { cn } from '../../utils/cn'

const EXTENSIONS: Record<CodeLanguage, () => ReturnType<typeof javascript>> = {
  javascript: () => javascript(),
  python: () => python(),
  java: () => java(),
  cpp: () => cpp(),
}

interface CodeEditorProps {
  value: string
  onChange: (v: string) => void
  language: CodeLanguage
  /** CSS height; "100%" fills the parent (the parent needs a height). */
  height?: string
  readOnly?: boolean
  ariaLabel?: string
  className?: string
}

/** CodeMirror 6 editor (bundled, no CDN) with language highlighting and the app theme. */
export function CodeEditor({ value, onChange, language, height = '420px', readOnly, ariaLabel = 'Code editor', className }: CodeEditorProps) {
  const { resolved } = useTheme()
  const extensions = useMemo(() => [EXTENSIONS[language]()], [language])
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line text-sm', className)} aria-label={ariaLabel}>
      <CodeMirror
        className="h-full"
        value={value}
        onChange={onChange}
        height={height}
        theme={resolved}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true, bracketMatching: true, closeBrackets: true, indentOnInput: true, tabSize: 4 }}
      />
    </div>
  )
}
