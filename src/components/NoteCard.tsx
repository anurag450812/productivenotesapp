import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Pin, Bell, Check, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Note } from '@/lib/types'
import { useNotes } from '@/context/NotesContext'
import { useTheme } from '@/context/ThemeContext'
import { useSettings } from '@/context/SettingsContext'
import { noteBg, noteBorder } from '@/lib/colors'
import { relativeLabel } from '@/lib/reminders'

interface Props {
  note: Note
  selected: boolean
  selectionMode: boolean
  view: 'grid' | 'list'
  onOpen: () => void
  onToggleSelect: () => void
  onLongPress: () => void
  onPin?: () => void
}

export default function NoteCard({ note, selected, selectionMode, view, onOpen, onToggleSelect, onLongPress, onPin }: Props) {
  const { sortedRemindersFor } = useNotes()
  const { theme } = useTheme()
  const { settings } = useSettings()
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressed = useRef(false)
  const reminders = note.is_reminder_note ? sortedRemindersFor(note.id).slice(0, 3) : []
  const isList = view === 'list'

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id, disabled: selectionMode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const nonEmptyLines = note.lines.filter((l) => l.text.trim() !== '')
  const heading = note.title || nonEmptyLines.find((l) => l.type === 'heading')?.text || nonEmptyLines[0]?.text || 'New note'
  const previewLines = note.collapsed ? [] : nonEmptyLines.slice(0, note.title ? 6 : 7)

  const startPress = () => {
    pressed.current = false
    pressTimer.current = setTimeout(() => {
      pressed.current = true
      onLongPress()
    }, 450)
  }
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  const handleClick = () => {
    if (pressed.current) { pressed.current = false; return }
    if (selectionMode) { onToggleSelect(); return }
    onOpen()
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      onClick={handleClick}
      className={`group relative rounded-xl2 shadow-sm hover:shadow-md cursor-pointer transition-shadow select-none ${
        isList ? 'w-full' : ''
      } ${selected ? 'ring-2 ring-amber-500' : ''} ${isDragging ? 'shadow-xl ring-2 ring-amber-400' : ''}`}
      style={{
        ...style,
        backgroundColor: noteBg(note.color, theme === 'dark'),
        border: `1px solid ${noteBorder(note.color, theme === 'dark')}`
      }}
    >
      {/* hover pin button - web only */}
      {onPin && (
        <button
          onClick={(e) => { e.stopPropagation(); onPin() }}
          className="absolute top-2 right-8 z-10 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-surface/80 hover:bg-amber-500/20 text-muted hover:text-amber-500"
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          <Pin size={14} fill={note.pinned ? 'currentColor' : 'none'} />
        </button>
      )}

      {/* drag handle */}
      {!selectionMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          style={{ opacity: isDragging ? 1 : undefined }}
          onPointerDown={(e) => { listeners.onPointerDown?.(e as any); e.stopPropagation() }}
        >
          <GripVertical size={14} className="text-muted/60" />
        </div>
      )}

      {/* selection checkbox overlay */}
      {selectionMode && (
        <div
          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted/60 bg-surface/80'
          }`}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </div>
      )}

      <div className="p-3">
        {note.pinned && (
          <Pin size={14} className="text-amber-500 mb-1 opacity-0 sm:opacity-100" fill="currentColor" />
        )}

        <h3
          className={`font-semibold leading-snug ${note.collapsed ? '' : 'mb-1'} ${isList ? '' : ''}`}
          style={{ fontSize: settings.headingFontSize }}
        >
          {heading}
        </h3>

        {!note.collapsed && (
          <>
            {note.image_url && (
              <img src={note.image_url} alt="" className="w-full max-h-32 object-cover rounded-lg my-1.5" />
            )}
            <div className="text-sm text-text/85 space-y-0">
              {previewLines.map((l) => (
                <div
                  key={l.id}
                  className={`flex items-start gap-1.5 truncate ${
                    l.type === 'heading' ? 'font-semibold' : ''
                  } ${l.type === 'task' && l.checked ? 'line-through text-muted' : ''}`}
                >
                  {l.type === 'task' && note.show_checkboxes && (
                    <span className={`mt-1 w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${l.checked ? 'bg-amber-500 border-amber-500' : 'border-muted/50'}`}>
                      {l.checked && <Check size={9} strokeWidth={3} className="text-white" />}
                    </span>
                  )}
                  <span className="truncate">{l.text}</span>
                </div>
              ))}
            </div>

            {reminders.length > 0 && (
              <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 space-y-0.5">
                {reminders.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <Bell size={11} className="text-amber-500 shrink-0" />
                    <span className={`truncate ${r.done ? 'line-through' : ''}`}>{r.title || 'Untitled'}</span>
                    <span className="ml-auto shrink-0">{relativeLabel(r).split(' · ')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {note.collapsed && nonEmptyLines.length > (note.title ? 0 : 1) && (
          <p className="text-xs text-muted">{nonEmptyLines.length - (note.title ? 0 : 1)} more lines</p>
        )}
      </div>
    </motion.div>
  )
}
