import { useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import { Check, Square, Heading1, Type, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { NoteLine } from '@/lib/types'
import { emptyLine } from '@/lib/db'
import { useSettings } from '@/context/SettingsContext'

interface Props {
  lines: NoteLine[]
  showCheckboxes: boolean
  readOnly?: boolean
  onChange: (lines: NoteLine[]) => void
}

function AutoInput({
  value, onChange, onEnter, onBackspaceEmpty, onPaste, placeholder, className, style, readOnly
}: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onPaste?: (text: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  readOnly?: boolean
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
      className={`line-input ${className ?? ''}`}
      placeholder={placeholder}
      value={value}
      style={style}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (readOnly) return
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onEnter()
        } else if (e.key === 'Backspace' && value === '') {
          e.preventDefault()
          onBackspaceEmpty()
        }
      }}
      onPaste={(e) => {
        if (readOnly) return
        const text = e.clipboardData.getData('text')
        if (text.includes('\n') || text.includes('\r')) {
          e.preventDefault()
          onPaste?.(text)
        }
      }}
    />
  )
}

function SortableLine({
  line, showCheckboxes, onUpdate, onCycleType, onToggleCheck, onPaste, onInsertAfter, onRemove
}: {
  line: NoteLine
  showCheckboxes: boolean
  onUpdate: (id: string, patch: Partial<NoteLine>) => void
  onCycleType: (id: string) => void
  onToggleCheck: (id: string) => void
  onPaste: (id: string, text: string) => void
  onInsertAfter: (id: string, nl?: NoteLine) => void
  onRemove: (id: string) => void
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: line.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const isTask = line.type === 'task'
  const showBox = isTask && showCheckboxes

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-2">
      <div
        {...attributes}
        {...listeners}
        className="mt-1.5 shrink-0 p-0.5 rounded cursor-grab active:cursor-grabbing text-muted/30 hover:text-amber-500 transition-colors touch-none"
        onPointerDown={(e) => { listeners?.onPointerDown?.(e as any); e.stopPropagation() }}
      >
        <GripVertical size={14} />
      </div>

      <button
        type="button"
        onClick={() => onCycleType(line.id)}
        className="mt-1.5 shrink-0 text-muted/60 hover:text-amber-500 transition-colors"
        title="Toggle: text / checkbox / heading"
      >
        {line.type === 'heading' ? <Heading1 size={16} /> : line.type === 'task' ? <Square size={16} /> : <Type size={16} />}
      </button>

      {showBox && (
        <button
          type="button"
          onClick={() => onToggleCheck(line.id)}
          className={`shrink-0 p-2 -m-2 rounded-md transition-all flex items-center justify-center min-w-[44px] min-h-[44px]`}
          aria-label={line.checked ? 'Mark incomplete' : 'Mark complete'}
        >
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
            line.checked
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'border-muted/50'
          }`}>
            {line.checked && <Check size={11} strokeWidth={3} />}
          </span>
        </button>
      )}

      <div className="flex-1 min-w-0" data-line-id={line.id}>
        <AutoInput
          value={line.text}
          placeholder={line.type === 'heading' ? 'Heading' : line.type === 'task' ? 'List item' : 'Note'}
          className={
            line.type === 'heading'
              ? 'font-semibold'
              : isTask && line.checked
              ? 'line-through text-muted'
              : ''
          }
          onChange={(v) => onUpdate(line.id, { text: v })}
          onPaste={(v) => onPaste(line.id, v)}
          onEnter={() => onInsertAfter(line.id, emptyLine(isTask ? 'task' : 'text'))}
          onBackspaceEmpty={() => {
            if (line.type !== 'text') {
              onUpdate(line.id, { type: 'text', checked: undefined })
            } else {
              onRemove(line.id)
            }
          }}
        />
      </div>
    </div>
  )
}

export default function LineEditor({ lines, showCheckboxes, readOnly, onChange }: Props) {
  const { settings } = useSettings()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const lineIds = lines.map((l) => l.id)

  const update = (id: string, patch: Partial<NoteLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const insertAfter = (id: string, newLine?: NoteLine) => {
    const idx = lines.findIndex((l) => l.id === id)
    const nl = newLine ?? emptyLine('text')
    const copy = [...lines]
    copy.splice(idx + 1, 0, nl)
    onChange(copy)
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

  const handlePaste = (id: string, text: string) => {
    const idx = lines.findIndex((l) => l.id === id)
    if (idx === -1) return
    const line = lines[idx]
    const pastedLines = text.split(/\r?\n/)
    const newLines: NoteLine[] = pastedLines.map((t) => ({
      id: nanoid(12),
      type: line.type,
      text: t,
      ...(line.type === 'task' ? { checked: false } : {})
    }))
    const copy = [...lines]
    copy.splice(idx, 1, ...newLines)
    onChange(copy)
    const lastNewId = newLines[newLines.length - 1].id
    requestAnimationFrame(() => {
      const container = document.querySelector<HTMLDivElement>(`[data-line-id="${lastNewId}"]`)
      const textarea = container?.querySelector<HTMLTextAreaElement>('textarea')
      if (textarea) {
        textarea.focus()
        const len = textarea.value.length
        textarea.setSelectionRange(len, len)
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = lines.findIndex((l) => l.id === active.id)
    const newIdx = lines.findIndex((l) => l.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    onChange(arrayMove(lines, oldIdx, newIdx))
  }

  if (readOnly) {
    return (
      <div className="space-y-0.5">
        {lines.map((line) => {
          const isTask = line.type === 'task'
          const showBox = isTask && showCheckboxes
          return (
            <div key={line.id} className="flex items-start gap-2" data-line-id={line.id}>
              {showBox && (
                <button type="button" disabled
                  className={`mt-1 shrink-0 rounded-md border-2 flex items-center justify-center ${
                    line.checked ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted/50'
                  }`}
                  style={{ width: 18, height: 18 }}
                >
                  {line.checked && <Check size={13} strokeWidth={3} />}
                </button>
              )}
              <div className="flex-1 min-w-0">
                <AutoInput
                  value={line.text}
                  readOnly
                  placeholder=""
                  className={
                    line.type === 'heading' ? 'font-semibold'
                      : isTask && line.checked ? 'line-through text-muted' : ''
                  }
                  style={line.type === 'heading' ? { fontSize: settings.headingFontSize } : undefined}
                  onChange={() => {}}
                  onEnter={() => {}}
                  onBackspaceEmpty={() => {}}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={lineIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {lines.map((line) => (
            <SortableLine
              key={line.id}
              line={line}
              showCheckboxes={showCheckboxes}
              onUpdate={update}
              onCycleType={cycleType}
              onToggleCheck={toggleCheck}
              onPaste={handlePaste}
              onInsertAfter={insertAfter}
              onRemove={removeLine}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
