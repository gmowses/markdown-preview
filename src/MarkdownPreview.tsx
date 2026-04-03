import { useState, useEffect, useMemo } from 'react'
import { Copy, Check, Sun, Moon, Languages, FileText } from 'lucide-react'

// ── i18n ─────────────────────────────────────────────────────────────────────
const translations = {
  en: {
    title: 'Markdown Preview',
    subtitle: 'Write markdown on the left, see live HTML preview on the right. Copy the rendered HTML. Client-side only.',
    editor: 'Markdown Editor',
    preview: 'HTML Preview',
    copyHtml: 'Copy HTML',
    copied: 'Copied!',
    clear: 'Clear',
    builtBy: 'Built by',
    chars: 'chars',
    words: 'words',
    lines: 'lines',
  },
  pt: {
    title: 'Preview de Markdown',
    subtitle: 'Escreva markdown a esquerda, veja o preview HTML a direita. Copie o HTML renderizado. Tudo no navegador.',
    editor: 'Editor Markdown',
    preview: 'Preview HTML',
    copyHtml: 'Copiar HTML',
    copied: 'Copiado!',
    clear: 'Limpar',
    builtBy: 'Criado por',
    chars: 'chars',
    words: 'palavras',
    lines: 'linhas',
  }
} as const
type Lang = keyof typeof translations

// ── Markdown converter ────────────────────────────────────────────────────────
function mdToHtml(md: string): string {
  let html = md
    // Escape HTML special chars first (but not in code blocks)
    .replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;')

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? ` class="language-${lang}"` : ''
    return `<pre><code${langClass}>${code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')

  // Images before links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />')

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Tables
  html = html.replace(/(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)+)/g, (table) => {
    const rows = table.trim().split('\n')
    const headers = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('')
    const dataRows = rows.slice(2).map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('')
      return `<tr>${cells}</tr>`
    }).join('\n')
    return `<table><thead><tr>${headers}</tr></thead><tbody>${dataRows}</tbody></table>`
  })

  // Blockquote
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')

  // Unordered lists
  html = html.replace(/((?:^[-*+]\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*+]\s+/, '')}</li>`).join('')
    return `<ul>${items}</ul>`
  })

  // Ordered lists
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('')
    return `<ol>${items}</ol>`
  })

  // Paragraphs: wrap non-tagged lines
  const lines = html.split('\n')
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { result.push(''); i++; continue }
    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table|hr|img)/.test(line)) {
      result.push(line); i++; continue
    }
    result.push(`<p>${line}</p>`)
    i++
  }

  return result.join('\n')
}

const DEFAULT_MD = `# Welcome to Markdown Preview

Write your **markdown** here and see the *live preview* on the right.

## Features

- Headers (H1-H6)
- **Bold** and *italic* text
- ~~Strikethrough~~
- \`inline code\`
- [Links](https://github.com/gmowses)

## Code Block

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Table

| Name | Type | Default |
|------|------|---------|
| lang | string | en |
| dark | boolean | false |

> Blockquote: Everything runs client-side. No data sent to servers.
`

export default function MarkdownPreview() {
  const [lang, setLang] = useState<Lang>(() => navigator.language.startsWith('pt') ? 'pt' : 'en')
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [md, setMd] = useState(DEFAULT_MD)
  const [copied, setCopied] = useState(false)

  const t = translations[lang]
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const html = useMemo(() => mdToHtml(md), [md])

  const chars = md.length
  const words = md.trim() ? md.trim().split(/\s+/).length : 0
  const lines = md.split('\n').length

  const copyHtml = () => {
    navigator.clipboard.writeText(html).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-500 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            <span className="font-semibold">Markdown Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyHtml} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-500 text-white hover:bg-slate-600 transition-colors">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.copied : t.copyHtml}
            </button>
            <button onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Languages size={14} />{lang.toUpperCase()}
            </button>
            <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="https://github.com/gmowses/markdown-preview" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto flex items-center gap-4 text-xs text-zinc-400">
          <span>{chars} {t.chars}</span>
          <span>{words} {t.words}</span>
          <span>{lines} {t.lines}</span>
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden px-4 py-4">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
          {/* Editor */}
          <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500">{t.editor}</span>
              <button onClick={() => setMd('')} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">{t.clear}</button>
            </div>
            <textarea
              value={md}
              onChange={e => setMd(e.target.value)}
              className="flex-1 resize-none font-mono text-sm p-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none min-h-[500px]"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500">{t.preview}</span>
            </div>
            <div
              className="flex-1 p-4 overflow-auto bg-white dark:bg-zinc-900 prose prose-zinc dark:prose-invert max-w-none min-h-[500px]
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:border-b [&_h1]:pb-2 [&_h1]:border-zinc-200 dark:[&_h1]:border-zinc-700
                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5
                [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4
                [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3
                [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:mb-1 [&_h5]:mt-2
                [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:mb-1 [&_h6]:mt-2
                [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-sm
                [&_ul]:mb-3 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:text-sm
                [&_ol]:mb-3 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:text-sm
                [&_li]:mb-1
                [&_strong]:font-semibold
                [&_em]:italic
                [&_del]:line-through [&_del]:text-zinc-400
                [&_code]:bg-zinc-100 dark:[&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-rose-600 dark:[&_code]:text-rose-400
                [&_pre]:bg-zinc-100 dark:[&_pre]:bg-zinc-800 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-3
                [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-800 dark:[&_pre_code]:text-zinc-200
                [&_blockquote]:border-l-4 [&_blockquote]:border-slate-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-500 [&_blockquote]:mb-3
                [&_a]:text-slate-500 [&_a]:underline [&_a]:hover:text-slate-700
                [&_table]:w-full [&_table]:mb-3 [&_table]:text-sm [&_table]:border-collapse
                [&_th]:border [&_th]:border-zinc-200 dark:[&_th]:border-zinc-700 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-zinc-50 dark:[&_th]:bg-zinc-800 [&_th]:font-semibold [&_th]:text-left
                [&_td]:border [&_td]:border-zinc-200 dark:[&_td]:border-zinc-700 [&_td]:px-3 [&_td]:py-2
                [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-700 [&_hr]:my-4
                [&_img]:max-w-full [&_img]:rounded-lg"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>{t.builtBy} <a href="https://github.com/gmowses" className="text-zinc-600 dark:text-zinc-300 hover:text-slate-500 transition-colors">Gabriel Mowses</a></span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
