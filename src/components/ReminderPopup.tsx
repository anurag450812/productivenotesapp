import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Clock, Check, Timer, EyeOff, AlertTriangle } from 'lucide-react'
import type { Reminder } from '@/lib/types'
import { useNotes } from '@/context/NotesContext'
import { nextDueDate, relativeLabel } from '@/lib/reminders'
import { addDays } from 'date-fns'

export default function ReminderPopup() {
  const { reminders, notes, updateReminder } = useNotes()
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Find due reminders: not done, due_at <= now, not hidden this session
  const dueReminders = useMemo(() => {
    const now = new Date()
    return reminders.filter((r) => {
      if (r.done) return false
      if (hiddenIds.has(r.id)) return false
      const due = nextDueDate(r, now)
      return due.getTime() <= now.getTime()
    })
  }, [reminders, hiddenIds])

  // Check periodically (every 30s)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  if (dueReminders.length === 0) return null

  return (
    <div className="fixed left-4 bottom-4 z-[60] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {dueReminders.map((r) => (
          <ReminderCard
            key={r.id}
            r={r}
            note={notes.find((n) => n.id === r.note_id)}
            onSnooze={() => {
              const due = nextDueDate(r, new Date())
              const newDue = addDays(due, 1)
              updateReminder(r.id, { due_at: newDue.toISOString() })
            }}
            onComplete={() => setConfirmId(r.id)}
            onHide={() => setHiddenIds((prev) => new Set([...prev, r.id]))}
            isConfirming={confirmId === r.id}
            onConfirmYes={() => {
              updateReminder(r.id, { done: true, completed_at: new Date().toISOString() })
              setConfirmId(null)
              setHiddenIds((prev) => new Set([...prev, r.id]))
            }}
            onConfirmNo={() => setConfirmId(null)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ReminderCard({
  r, note, onSnooze, onComplete, onHide,
  isConfirming, onConfirmYes, onConfirmNo
}: {
  r: Reminder
  note: any
  onSnooze: () => void
  onComplete: () => void
  onHide: () => void
  isConfirming: boolean
  onConfirmYes: () => void
  onConfirmNo: () => void
}) {
  const tasks = note?.lines?.filter((l: any) => l.type === 'task') || []

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="pointer-events-auto"
    >
      <div className="relative bg-red-50 dark:bg-red-950/80 border-2 border-red-400 dark:border-red-600 rounded-2xl shadow-2xl shadow-red-500/30 overflow-hidden animate-pulse-gentle">
        {/* blinking red dot */}
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>

        <div className="p-4">
          {/* header */}
          <div className="flex items-start gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
              <Bell size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-red-700 dark:text-red-300 truncate">
                {r.title || 'Reminder'}
              </h4>
              <div className="flex items-center gap-1 text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                <Clock size={11} />
                <span>{relativeLabel(r)}</span>
              </div>
            </div>
          </div>

          {/* linked note tasks */}
          {tasks.length > 0 && (
            <div className="mb-3 bg-white/50 dark:bg-black/20 rounded-lg p-2 space-y-1">
              {tasks.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-sm border shrink-0 flex items-center justify-center ${
                    t.checked ? 'bg-amber-500 border-amber-500' : 'border-red-300 dark:border-red-600'
                  }`}>
                    {t.checked && <Check size={8} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className={t.checked ? 'line-through text-muted' : 'text-text'}>
                    {t.text || '(empty)'}
                  </span>
                </div>
              ))}
              {tasks.length > 5 && (
                <p className="text-[10px] text-muted">+{tasks.length - 5} more tasks</p>
              )}
            </div>
          )}

          {/* action buttons */}
          {isConfirming ? (
            <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/50 rounded-lg p-2">
              <AlertTriangle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300 flex-1">Mark as completed?</span>
              <button onClick={onConfirmNo} className="text-xs px-3 py-2 rounded min-h-[44px] text-muted hover:bg-white/50 dark:hover:bg-black/20">No</button>
              <button onClick={onConfirmYes} className="text-xs px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600 min-h-[44px]">Yes</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onSnooze}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                <Timer size={14} />
                Snooze 1 day
              </button>
              <button
                onClick={onComplete}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                <Check size={14} />
                Complete
              </button>
              <button
                onClick={onHide}
                className="flex items-center justify-center gap-1 px-2.5 py-2.5 rounded-xl bg-white/60 dark:bg-black/30 hover:bg-white/80 dark:hover:bg-black/50 text-muted text-xs font-semibold transition-colors border border-red-200 dark:border-red-800 min-w-[44px] min-h-[44px]"
                title="Hide until next reload"
              >
                <EyeOff size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
