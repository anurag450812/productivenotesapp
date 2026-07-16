import { useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import { Check, Square, Heading1, Type, GripVertical } from 'lucide-react'
import { motion } from 'framer-motion'
import type { NoteLine } from '@/lib/types'
import { emptyLine } from '@/lib/db'
import { useSettings } from '@/context/SettingsContext'

interface Props {
  lines: NoteLine[]
  showCheckboxes: boolean
  readOnly?: boolean
  onChange: (lines: NoteLine[]) => void
}

// Auto-grow input
function AutoInput({
  value, onChange, onEnter, onBackspaceEmpty, placeholder, className, ariaLabel, style
}: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  placeholder?: string
  className?: string
  ariaLabel?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      className={`line-input ${className ?? ''}`}
      placeholder={placeholder}
      value={value}
      style={style}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onEnter()
        } else if (e.key === 'Backspace' && value === '') {
          e.preventDefault()
          onBackspaceEmpty()
        }
      }}
    />
  )
}

export default function LineEditor({ lines, showCheckboxes, readOnly, onChange }: Props) {
  const { settings } = useSettings()
  const update = (id: string, patch: Partial<NoteLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const insertAfter = (id: string, newLine?: NoteLine) => {
    const idx = lines.findIndex((l) => l.id === id)
    const nl = newLine ?? emptyLine('text')
    const copy = [...lines]
    copy.splice(idx + 1, 0, nl)
    onChange(copy)
    // focus the textarea inside the new line after React re-renders
    requestAnimationFrame(() => {
      const container = document.querySelector<HTMLDivElement>(`[data-line-id="${nl.id}"]`)
      const textarea = container?.querySelector<HTMLTextAreaElement>('textarea')
      textarea?.focus()
    })
  }

  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      onChange([emptyLine('text')])
      return
    }
    const idx = lines.findIndex((l) => l.id === id)
    const copy = lines.filter((l) => l.id !== id)
    onChange(copy)
    const focusId = copy[Math.max(0, idx - 1)]?.id
    if (focusId) {
      requestAnimationFrame(() => {
        const container = document.querySelector<HTMLDivElement>(`[data-line-id="${focusId}"]`)
        const textarea = container?.querySelector<HTMLTextAreaElement>('textarea')
        if (textarea) {
          textarea.focus()
          const len = textarea.value.length
          textarea.setSelectionRange(len, len)
        }
      })
    }
  }

  const toggleCheck = (id: string) => {
    const line = lines.find((l) => l.id === id)
    if (!line) return
    update(id, { checked: !line.checked })
  }

  const cycleType = (id: string) => {
    const line = lines.find((l) => l.id === id)
    if (!line) return
    const order: NoteLine['type'][] = ['text', 'task', 'heading']
    const next = order[(order.indexOf(line.type) + 1) % order.length]
    update(id, { type: next, checked: next === 'task' ? line.checked ?? false : undefined })
  }

  return (
    <div className="space-y-0.5">
      {lines.map((line) => {
        const isTask = line.type === 'task'
        const showBox = isTask && showCheckboxes
        return (
          <div key={line.id} className="group flex items-start gap-2">
            {/* left control */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => cycleType(line.id)}
                className="mt-1.5 shrink-0 text-muted/60 hover:text-amber-500 transition-colors"
                title="Toggle: text / checkbox / heading"
              >
                {line.type === 'heading' ? <Heading1 size={16} /> : line.type === 'task' ? <Square size={16} /> : <Type size={16} />}
              </button>
            )}

            {/* checkbox */}
            {showBox && (
              <button
                type="button"
                onClick={() => toggleCheck(line.id)}
                className={`mt-1 shrink-0 rounded-md border-2 transition-all flex items-center justify-center ${
                  line.checked
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-muted/50 hover:border-amber-500'
                }`}
                style={{ width: 18, height: 18 }}
                aria-label={line.checked ? 'Mark incomplete' : 'Mark complete'}
              >
                {line.checked && <Check size={13} strokeWidth={3} />}
              </button>
            )}

            <div className="flex-1 min-w-0" data-line-id={line.id}>
              <AutoInput
                ariaLabel={line.type}
                value={line.text}
                placeholder={line.type === 'heading' ? 'Heading' : line.type === 'task' ? 'List item' : 'Note'}
                className={
                  line.type === 'heading'
                    ? 'font-semibold'
                    : isTask && line.checked
                    ? 'line-through text-muted'
                    : ''
                }
                style={line.type === 'heading' ? { fontSize: settings.headingFontSize } : undefined}
                onChange={(v) => update(line.id, { text: v })}
                onEnter={() => insertAfter(line.id, emptyLine(isTask ? 'task' : 'text'))}
                onBackspaceEmpty={() => {
                  // on backspace of empty: if line is task/heading, convert to text first; else remove
                  if (line.type !== 'text') {
                    update(line.id, { type: 'text', checked: undefined })
                  } else {
                    removeLine(line.id)
                  }
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { nanoid }
