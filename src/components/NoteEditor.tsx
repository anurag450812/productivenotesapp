import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Pin, Archive, Trash2, Palette, CheckSquare, EyeOff, Eye, RotateCcw, X,
  Image as ImageIcon, Bell, BellOff, Minimize2, Copy
} from 'lucide-react'
import type { Note } from '@/lib/types'
import { useNotes } from '@/context/NotesContext'
import { useTheme } from '@/context/ThemeContext'
import { COLOR_ORDER, NOTE_COLORS, noteBg, noteBorder } from '@/lib/colors'
import LineEditor from './LineEditor'
import RemindersList from './RemindersList'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Props {
  note: Note
  onClose: () => void
}

export default function NoteEditor({ note, onClose }: Props) {
  const { updateNote, saveNoteNow, trashNote, addNote } = useNotes()
  const { theme } = useTheme()
  const { user } = useAuth()
  const [local, setLocal] = useState<Note>(note)
  const [showPalette, setShowPalette] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)

  // sync external changes when not dirty
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

  const close = async () => {
    await saveNoteNow(note.id)
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

  const uncheckAll = () => {
    commit({ lines: local.lines.map((l) => (l.type === 'task' ? { ...l, checked: false } : l)) })
  }

  const duplicate = () => {
    addNote({
      title: local.title + ' (copy)',
      lines: local.lines.map((l) => ({ ...l, id: Math.random().toString(36).slice(2) })),
      color: local.color,
      is_reminder_note: false
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        className="w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-pop"
        style={{ backgroundColor: bg, borderColor: bd, borderWidth: 1 }}
        initial={{ y: 30, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
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
            className="line-input text-lg font-semibold flex-1"
          />
          <button
            onClick={() => commit({ pinned: !local.pinned })}
            className={`p-2 rounded-full transition-colors ${local.pinned ? 'text-amber-500' : 'text-muted/60 hover:text-amber-500'}`}
          ><Pin size={18} fill={local.pinned ? 'currentColor' : 'none'} /></button>
        </div>

        {/* body */}
        <div className="px-3 py-2 overflow-y-auto">
          <LineEditor
            lines={local.lines}
            showCheckboxes={local.show_checkboxes}
            onChange={(lines) => commit({ lines })}
          />
          {local.is_reminder_note && <div className="mt-3"><RemindersList noteId={note.id} /></div>}
        </div>

        {/* toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-t border-black/5 dark:border-white/5 flex-wrap">
          <Tool title={local.archived ? 'Unarchive' : 'Archive'} onClick={() => { commit({ archived: !local.archived }); close() }}>
            <Archive size={18} />
          </Tool>
          <Tool title="Delete" onClick={() => { trashNote(note.id); close() }}><Trash2 size={18} /></Tool>
          <Tool title="Add image" onClick={() => fileRef.current?.click()}><ImageIcon size={18} /></Tool>
          <Tool title={local.is_reminder_note ? 'Disable reminders' : 'Enable reminders'} onClick={() => commit({ is_reminder_note: !local.is_reminder_note })}>
            {local.is_reminder_note ? <Bell size={18} className="text-amber-500" /> : <BellOff size={18} />}
          </Tool>
          <Tool title={local.show_checkboxes ? 'Hide checkboxes' : 'Show checkboxes'} onClick={() => commit({ show_checkboxes: !local.show_checkboxes })}>
            {local.show_checkboxes ? <Eye size={18} /> : <EyeOff size={18} />}
          </Tool>
          <Tool title="Uncheck all items" onClick={uncheckAll}><RotateCcw size={18} /></Tool>
          <Tool title="Duplicate note" onClick={duplicate}><Copy size={18} /></Tool>
          <Tool title={local.collapsed ? 'Expand default' : 'Collapse by default'} onClick={() => commit({ collapsed: !local.collapsed })}>
            <Minimize2 size={18} />
          </Tool>
          <Tool title="Color" onClick={() => setShowPalette((s) => !s)}><Palette size={18} /></Tool>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />

          <div className="ml-auto flex items-center gap-1">
            <button onClick={close} className="text-sm font-medium px-4 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
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
    </motion.div>
  )
}

function Tool({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-full text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-500 transition-colors">
      {children}
    </button>
  )
}
