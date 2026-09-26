import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import { useTheme } from '../../app/themeContext'
import type { CodeLanguage } from '../../types/api'

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
  height?: string
  readOnly?: boolean
  ariaLabel?: string
}

/** CodeMirror 6 editor (bundled, no CDN) with language highlighting and the app theme. */
export function CodeEditor({ value, onChange, language, height = '420px', readOnly, ariaLabel = 'Code editor' }: CodeEditorProps) {
  const { resolved } = useTheme()
  const extensions = useMemo(() => [EXTENSIONS[language]()], [language])
  return (
    <div className="overflow-hidden rounded-lg border border-line text-sm" aria-label={ariaLabel}>
      <CodeMirror
        value={value}
        onChange={onChange}
        height={height}
        theme={resolved}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true, tabSize: 4 }}
      />
    </div>
  )
}
