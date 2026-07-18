import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pin, Archive, Trash2, Palette, EyeOff, Eye, RotateCcw, X,
  Image as ImageIcon, Bell, BellOff, Minimize2, Copy, ChevronDown, ChevronUp, PanelRight
} from 'lucide-react'
import type { Note } from '@/lib/types'
import { useNotes } from '@/context/NotesContext'
import { useTheme } from '@/context/ThemeContext'
import { useSettings } from '@/context/SettingsContext'
import { COLOR_ORDER, NOTE_COLORS, noteBg, noteBorder } from '@/lib/colors'
import LineEditor from './LineEditor'
import RemindersList from './RemindersList'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Props {
  note: Note
  noteRect?: DOMRect | null
  onClose: () => void
  onAddToSidebar?: () => void
}

export default function NoteEditor({ note, noteRect, onClose, onAddToSidebar }: Props) {
  const { updateNote, saveNoteNow, trashNote, addNote, deleteForever } = useNotes()
  const { theme } = useTheme()
  const { user } = useAuth()
  const { settings } = useSettings()
  const [local, setLocal] = useState<Note>(note)
  const [showPalette, setShowPalette] = useState(false)
  const [collapseChecked, setCollapseChecked] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!dirtyRef.current) setLocal(note)
  }, [note])

  const commit = (patch: Partial<Note>) => {
    dirtyRef.current = true
    setLocal((prev) => ({ ...prev, ...patch }))
    updateNote(note.id, patch)
  }

  const bg = noteBg(local.color, theme === 'dark')
  const bd = noteBorder(local.color, theme === 'dark')

  const close = async (immediate = false) => {
    const hasContent = local.title.trim() !== '' || local.lines.some((l) => l.text.trim() !== '') || local.image_url
    if (!hasContent) {
      try { await deleteForever(note.id) } catch { /* ignore */ }
      dirtyRef.current = false
      onClose()
      return
    }
    try { await saveNoteNow(note.id) } catch { /* ignore save errors on close */ }
    dirtyRef.current = false
    onClose()
  }

  const onImage = async (file: File) => {
    if (!user) return
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${note.id}.${ext}`
    const { error } = await supabase.storage.from('note-images').upload(path, file, { upsert: true })
    if (error) { console.error(error); return }
    const { data } = supabase.storage.from('note-images').getPublicUrl(path)
    commit({ image_url: data.publicUrl })
  }

  const toggleCheckAll = () => {
    const tasks = local.lines.filter((l) => l.type === 'task')
    const allUnchecked = tasks.length > 0 && tasks.every((l) => !l.checked)
    commit({
      lines: local.lines.map((l) => (l.type === 'task' ? { ...l, checked: allUnchecked } : l))
    })
  }

  const duplicate = () => {
    addNote({
      title: local.title + ' (copy)',
      lines: local.lines.map((l) => ({ ...l, id: Math.random().toString(36).slice(2) })),
      color: local.color,
      is_reminder_note: false
    })
  }

  // Split lines: text/headings first, then unchecked tasks, then checked tasks
  if (!local?.lines) return null
  const hasTasks = local.lines.some((l) => l.type === 'task')
  const textLines = local.lines.filter((l) => l.type !== 'task')
  const uncheckedTasks = local.lines.filter((l) => l.type === 'task' && !l.checked)
  const doneLines = local.lines.filter((l) => l.type === 'task' && l.checked)
  const activeLines = [...textLines, ...uncheckedTasks]

  const vw = typeof window !== 'undefined' ? window.innerWidth : 640
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const desktop = vw >= 640
  const editorW = desktop ? Math.min(640, vw - 32) : vw

  let initial: Record<string, any>
  let animate: Record<string, any>
  let exit: Record<string, any>

  if (noteRect) {
    const cx = noteRect.left + noteRect.width / 2
    const cy = noteRect.top + noteRect.height / 2
    const sX = noteRect.width / editorW
    const s = Math.min(sX, 1)
    const startTop = cy - noteRect.height / 2
    const startLeft = cx - editorW * s / 2
    const endTop = desktop ? '50%' : vh - 200
    const endLeft = (vw - editorW) / 2

    initial = { position: 'fixed' as const, top: startTop, left: startLeft, width: editorW, scale: s, borderRadius: 12, opacity: 1 }
    animate = { position: 'fixed' as const, top: endTop, left: endLeft, width: editorW, y: desktop ? '-50%' : 0, scale: 1, borderRadius: 16, opacity: 1 }
    exit = { position: 'fixed' as const, top: startTop, left: startLeft, width: editorW, scale: s, borderRadius: 12, opacity: 0 }
  } else {
    const endTop = desktop ? '50%' : vh - 200
    const endLeft = (vw - editorW) / 2
    initial = { position: 'fixed' as const, top: endTop, left: endLeft, width: editorW, y: desktop ? '-40%' : 40, scale: 0.92, opacity: 0 }
    animate = { position: 'fixed' as const, top: endTop, left: endLeft, width: editorW, y: desktop ? '-50%' : 0, scale: 1, opacity: 1 }
    exit = { position: 'fixed' as const, top: endTop, left: endLeft, width: editorW, y: desktop ? '-45%' : 20, scale: 0.94, opacity: 0 }
  }

  return (
    <>
      {/* backdrop — z-50 */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => close(true)}
      />

      {/* content card — z-[52] so sidebar at z-[51] stays visible */}
      <div className="fixed inset-0 z-[52] pointer-events-none" onClick={() => close(true)}>
        <motion.div
          data-note-editor
          className="pointer-events-auto w-full flex flex-col max-h-[85vh] overflow-hidden"
          style={{ backgroundColor: bg, borderColor: bd, borderWidth: 1 }}
          initial={initial}
          animate={animate}
          exit={exit}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* image */}
        {local.image_url && (
          <div className="relative">
            <img src={local.image_url} alt="" className="w-full max-h-56 object-cover" />
            <button
              onClick={() => commit({ image_url: null })}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            ><X size={14} /></button>
          </div>
        )}

        {/* top row: pin */}
        <div className="flex items-center justify-between px-3 pt-3">
          <input
            value={local.title}
            onChange={(e) => commit({ title: e.target.value })}
            placeholder="Title"
            className="line-input font-semibold flex-1"
            style={{ fontSize: settings.headingFontSize }}
          />
          <button
            onClick={() => commit({ pinned: !local.pinned })}
            className={`p-2 rounded-full transition-colors ${local.pinned ? 'text-amber-500' : 'text-muted/60 hover:text-amber-500'}`}
          ><Pin size={18} fill={local.pinned ? 'currentColor' : 'none'} /></button>
        </div>

        {/* body */}
        <div className="px-3 py-2 flex-1 min-h-0 overflow-y-auto">
          {/* Active lines: text/headings first, then unchecked tasks */}
          <LineEditor
            lines={activeLines}
            showCheckboxes={local.show_checkboxes}
            onChange={(newActive) => {
              commit({ lines: [...newActive, ...doneLines] })
            }}
          />

          {/* Checked section divider */}
          {hasTasks && doneLines.length > 0 && (
            <div className="my-2">
              <button
                onClick={() => setCollapseChecked((c) => !c)}
                className="w-full flex items-center gap-2 py-1.5 text-sm text-muted hover:text-text transition-colors"
              >
                <div className="flex-1 h-px bg-border" />
                <span className="flex items-center gap-1 text-xs font-medium whitespace-nowrap">
                  {collapseChecked ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  ✓ {doneLines.length} completed
                </span>
                <div className="flex-1 h-px bg-border" />
              </button>
            </div>
          )}

          {/* Done lines: checked tasks (collapsible) */}
          <AnimatePresence initial={false}>
            {hasTasks && doneLines.length > 0 && !collapseChecked && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LineEditor
                  lines={doneLines}
                  showCheckboxes={local.show_checkboxes}
                  onChange={(newDone) => commit({ lines: [...activeLines, ...newDone] })}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {local.is_reminder_note && <div className="mt-3"><RemindersList noteId={note.id} /></div>}
        </div>

        {/* toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-t border-black/5 dark:border-white/5 flex-wrap flex-shrink-0">
          <Tool title={local.archived ? 'Unarchive' : 'Archive'} onClick={() => { commit({ archived: !local.archived }); close() }}>
            <Archive size={18} />
          </Tool>
          <Tool title="Move to trash" onClick={() => { trashNote(note.id); dirtyRef.current = false; onClose() }}><Trash2 size={18} /></Tool>
          <Tool title="Add image" onClick={() => fileRef.current?.click()}><ImageIcon size={18} /></Tool>
          <Tool title={local.is_reminder_note ? 'Disable reminders' : 'Enable reminders'} onClick={() => commit({ is_reminder_note: !local.is_reminder_note })}>
            {local.is_reminder_note ? <Bell size={18} className="text-amber-500" /> : <BellOff size={18} />}
          </Tool>
          <Tool title={local.show_checkboxes ? 'Hide checkboxes' : 'Show checkboxes'} onClick={() => commit({ show_checkboxes: !local.show_checkboxes })}>
            {local.show_checkboxes ? <Eye size={18} /> : <EyeOff size={18} />}
          </Tool>
          <Tool title="Toggle check all" onClick={toggleCheckAll}><RotateCcw size={18} /></Tool>
          <Tool title="Duplicate note" onClick={duplicate}><Copy size={18} /></Tool>
          <Tool title={local.collapsed ? 'Expand default' : 'Collapse by default'} onClick={() => commit({ collapsed: !local.collapsed })}>
            <Minimize2 size={18} />
          </Tool>
          <Tool title="Color" onClick={() => setShowPalette((s) => !s)}><Palette size={18} /></Tool>
          {onAddToSidebar && <Tool title="Pin to sidebar" onClick={() => { onAddToSidebar(); close() }}><PanelRight size={18} /></Tool>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => close()} className="text-sm font-medium px-4 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              Done
            </button>
          </div>
        </div>

        {/* color palette */}
        {showPalette && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="px-4 pb-3 flex flex-wrap gap-2"
          >
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                onClick={() => { commit({ color: c }); setShowPalette(false) }}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: theme === 'dark' ? NOTE_COLORS[c].dark : NOTE_COLORS[c].light, borderColor: local.color === c ? '#f59e0b' : 'transparent' }}
                title={NOTE_COLORS[c].name}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
      </div>
    </>
  )
}

function Tool({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-full text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-500 transition-colors">
      {children}
    </button>
  )
}
