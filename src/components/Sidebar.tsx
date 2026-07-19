import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, Pin, Check, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Note } from '@/lib/types'
import { useTheme } from '@/context/ThemeContext'
import { noteBg, noteBorder } from '@/lib/colors'

interface Props {
  open: boolean
  onClose: () => void
  noteIds: string[]
  notes: Note[]
  onRemove: (id: string) => void
  onReorder: (newOrder: string[]) => void
  isDragging?: boolean
  onToggleTask?: (noteId: string, lineId: string) => void
  width: number
  onWidthChange?: (w: number) => void
}

const MIN_W = 240
const MAX_W = 600
const DEFAULT_W = 320

export default function Sidebar({ open, onClose, noteIds, notes, onRemove, onReorder, isDragging, onToggleTask, width, onWidthChange }: Props) {
  const { theme } = useTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // resize via left-edge drag
  const resizing = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    resizing.current = true
    startX.current = e.clientX
    startW.current = width
    const onMove = (ev: PointerEvent) => {
      if (!resizing.current) return
      const delta = startX.current - ev.clientX
      const newW = Math.max(MIN_W, Math.min(MAX_W, startW.current + delta))
      onWidthChange?.(newW)
    }
    const onUp = () => {
      resizing.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width, onWidthChange])

  const sidebarNotes = noteIds
    .map((id) => notes.find((n) => n.id === id))
    .filter(Boolean) as Note[]

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = noteIds.indexOf(active.id as string)
    const newIndex = noteIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const newArr = [...noteIds]
    newArr.splice(oldIndex, 1)
    newArr.splice(newIndex, 0, active.id as string)
    onReorder(newArr)
  }

  const sidebarContent = (
    <div className={`h-full flex flex-col bg-surface border-l border-border relative ${isDragging ? 'pointer-events-none' : ''}`}>
      {/* resize handle */}
      <div
        onPointerDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-amber-500/40 transition-colors z-10 group hidden sm:block"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-amber-500 transition-colors" />
      </div>

      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Pin size={14} className="text-amber-500" fill="currentColor" />
          Sidebar
          {sidebarNotes.length > 0 && <span className="text-xs text-muted font-normal">({sidebarNotes.length})</span>}
        </h3>
        <button onClick={onClose} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center">
          <X size={20} />
        </button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sidebarNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
              <Pin size={24} className="text-amber-500/50" />
            </div>
            <p className="text-sm font-medium mb-1">No pinned notes</p>
            <p className="text-xs opacity-60 leading-relaxed">Drag a note card here or use the sidebar button in the toolbar for quick reference.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
              {sidebarNotes.map((note) => (
                <SortableSidebarCard
                  key={note.id}
                  note={note}
                  isExpanded={expandedId === note.id}
                  onToggle={() => setExpandedId(expandedId === note.id ? null : note.id)}
                  onRemove={() => onRemove(note.id)}
                  onToggleTask={onToggleTask}
                  theme={theme}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* footer */}
      {sidebarNotes.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border shrink-0 text-center">
          <p className="text-[11px] text-muted">Drag to reorder · Click headings to expand · Drag edge to resize</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* mobile: overlay drawer */}
      <div className="sm:hidden">
        {open && <div className="fixed inset-0 z-[50] bg-black/30" onClick={onClose} />}
        <AnimatePresence>
          {open && (
            <motion.div
              data-note-editor
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 w-full z-[51] shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* desktop: permanent panel */}
      <div className="hidden sm:block fixed right-0 top-0 bottom-0 z-[48]" style={{ width }}>
        {sidebarContent}
      </div>
    </>
  )
}

function SortableSidebarCard({
  note, isExpanded, onToggle, onRemove, onToggleTask, theme
}: {
  note: Note
  isExpanded: boolean
  onToggle: () => void
  onRemove: () => void
  onToggleTask?: (noteId: string, lineId: string) => void
  theme: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const heading = note.title || note.lines.find((l) => l.text.trim())?.text || 'Untitled'
  const contentLines = note.lines.filter((l) => l.text.trim())

  return (
    <motion.div
      ref={setNodeRef}
      layout
      style={style}
      className="rounded-xl border overflow-hidden"
      {...attributes}
    >
      <div
        style={{
          backgroundColor: noteBg(note.color, theme === 'dark'),
          borderColor: noteBorder(note.color, theme === 'dark'),
          borderWidth: 1,
        }}
      >
        {/* heading row */}
        <div className="flex items-start">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            {...listeners}
            className="px-1.5 flex items-center text-muted/50 hover:text-muted cursor-grab active:cursor-grabbing shrink-0 mt-2.5"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
          <button
            onClick={onToggle}
            className="flex-1 flex items-start gap-2 px-2 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-0"
          >
            <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="shrink-0 mt-0.5">
              <ChevronRight size={14} className="text-muted" />
            </motion.span>
            <span className="text-sm font-semibold leading-snug break-words">{heading}</span>
          </button>
          <button
            onClick={onRemove}
            className="px-2 text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 mt-2"
            title="Remove from sidebar"
          >
            <X size={14} />
          </button>
        </div>

        {/* expandable content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 text-sm text-text/80 space-y-1 border-t border-black/5 dark:border-white/5 pt-2">
                {contentLines.length === 0 ? (
                  <p className="text-xs text-muted italic">Empty note</p>
                ) : (
                  contentLines.map((l) => (
                    <div
                      key={l.id}
                      className={`flex items-start gap-1.5 leading-relaxed ${
                        l.type === 'heading' ? 'font-semibold text-text mt-2' : ''
                      }`}
                    >
                      {l.type === 'task' && note.show_checkboxes && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleTask?.(note.id, l.id) }}
                          className={`mt-1.5 w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
                            l.checked ? 'bg-amber-500 border-amber-500' : 'border-muted/50 hover:border-amber-500/50'
                          }`}
                        >
                          {l.checked && <Check size={9} strokeWidth={3} className="text-white" />}
                        </button>
                      )}
                      <span className={`${l.type === 'task' && l.checked ? 'line-through text-muted' : ''} break-words`}>
                        {l.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
