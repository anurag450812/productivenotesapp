import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Plus, Trash2, Check, Repeat, CalendarClock } from 'lucide-react'
import type { Reminder, RepeatType } from '@/lib/types'
import { useNotes } from '@/context/NotesContext'
import { relativeLabel, repeatLabel, DOW_NAMES, sortRemindersByUpcoming } from '@/lib/reminders'
import { format } from 'date-fns'

export default function RemindersList({ noteId }: { noteId: string }) {
  const { sortedRemindersFor, addReminder, updateReminder, removeReminder } = useNotes()
  const list = sortedRemindersFor(noteId)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="rounded-xl2 border border-border/60 bg-bg/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
          <Bell size={15} /> Reminders
          <span className="text-muted font-normal">· sorted by upcoming</span>
        </div>
        <button
          onClick={() => {
            const r = addReminder(noteId, '')
            setEditingId(r.id)
          }}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {list.map((r) => (
            <ReminderRow
              key={r.id}
              r={r}
              editing={editingId === r.id}
              onEdit={() => setEditingId(r.id)}
              onClose={() => setEditingId(null)}
              onUpdate={(p) => updateReminder(r.id, p)}
              onRemove={() => removeReminder(r.id)}
            />
          ))}
        </AnimatePresence>
        {list.length === 0 && (
          <p className="text-xs text-muted py-2 text-center">No reminders yet. Add one above.</p>
        )}
      </div>
    </div>
  )
}

function ReminderRow({
  r, editing, onEdit, onClose, onUpdate, onRemove
}: {
  r: Reminder
  editing: boolean
  onEdit: () => void
  onClose: () => void
  onUpdate: (p: Partial<Reminder>) => void
  onRemove: () => void
}) {
  const done = r.done

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        done ? 'opacity-50' : 'hover:bg-surface/60'
      }`}
    >
      <button
        onClick={() => onUpdate({ done: !done, completed_at: !done ? new Date().toISOString() : null })}
        className={`mt-0.5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
          done ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted/50 hover:border-amber-500'
        }`}
        style={{ width: 18, height: 18 }}
        aria-label="toggle done"
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <EditForm r={r} onUpdate={onUpdate} onClose={onClose} />
        ) : (
          <button onClick={onEdit} className="text-left w-full">
            <div className={`text-sm font-medium ${done ? 'line-through' : ''}`}>{r.title || 'Untitled reminder'}</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted mt-0.5">
              <span className="flex items-center gap-1"><CalendarClock size={11} /> {relativeLabel(r)}</span>
              {r.repeat_type !== 'none' && (
                <span className="flex items-center gap-1"><Repeat size={11} /> {r.repeat_type === 'weekly' ? DOW_NAMES[r.repeat_dow ?? 0] : r.repeat_type === 'monthly' ? `monthly d${r.repeat_dom}` : `day-after d${r.repeat_dom}`}</span>
              )}
            </div>
          </button>
        )}
      </div>

      <button onClick={onRemove} className="mt-0.5 text-muted/50 hover:text-red-500 transition-colors shrink-0">
        <Trash2 size={14} />
      </button>
    </motion.div>
  )
}

function EditForm({
  r, onUpdate, onClose
}: {
  r: Reminder
  onUpdate: (p: Partial<Reminder>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(r.title)
  const dueLocal = format(new Date(r.due_at), "yyyy-MM-dd'T'HH:mm")
  const [due, setDue] = useState(dueLocal)
  const [repeat, setRepeat] = useState<RepeatType>(r.repeat_type)
  const [dow, setDow] = useState(r.repeat_dow ?? new Date(r.due_at).getDay())
  const [dom, setDom] = useState(r.repeat_dom ?? new Date(r.due_at).getDate())

  const save = () => {
    const dueDate = new Date(due)
    onUpdate({
      title,
      due_at: dueDate.toISOString(),
      repeat_type: repeat,
      repeat_dow: repeat === 'weekly' ? dow : null,
      repeat_dom: repeat === 'monthly' || repeat === 'monthly_day_after' ? dom : null
    })
    onClose()
  }

  return (
    <div className="space-y-2 bg-surface/80 rounded-lg p-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Reminder title"
        className="line-input text-sm font-medium"
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="bg-bg/60 rounded-md px-2 py-1 border border-border"
        />
        <select
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatType)}
          className="bg-bg/60 rounded-md px-2 py-1 border border-border"
        >
          <option value="none">One-time</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly (day X)</option>
          <option value="monthly_day_after">Monthly (day after X)</option>
        </select>
        {repeat === 'weekly' && (
          <select value={dow} onChange={(e) => setDow(Number(e.target.value))} className="bg-bg/60 rounded-md px-2 py-1 border border-border">
            {DOW_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        )}
        {(repeat === 'monthly' || repeat === 'monthly_day_after') && (
          <select value={dom} onChange={(e) => setDom(Number(e.target.value))} className="bg-bg/60 rounded-md px-2 py-1 border border-border">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs px-2 py-1 text-muted">Cancel</button>
        <button onClick={save} className="text-xs px-3 py-1 rounded-md bg-amber-500 text-white">Save</button>
      </div>
    </div>
  )
}
