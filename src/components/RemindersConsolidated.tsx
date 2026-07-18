import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, Clock, Check, Repeat, ChevronRight } from 'lucide-react'
import type { Reminder } from '@/lib/types'
import { useNotes } from '@/context/NotesContext'
import { nextDueDate, relativeLabel, repeatLabel } from '@/lib/reminders'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { noteBg, noteBorder } from '@/lib/colors'
import { useTheme } from '@/context/ThemeContext'

export default function RemindersConsolidated() {
  const { reminders, notes } = useNotes()
  const { theme } = useTheme()

  const sorted = useMemo(() => {
    const now = new Date()
    return [...reminders]
      .filter((r) => !r.done)
      .sort((a, b) => nextDueDate(a, now).getTime() - nextDueDate(b, now).getTime())
  }, [reminders])

  // group by day
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: Reminder[] }>()
    for (const r of sorted) {
      const due = nextDueDate(r, new Date())
      const dayKey = format(due, 'yyyy-MM-dd')
      let label: string
      if (isPast(due) && !isToday(due)) label = 'Overdue'
      else if (isToday(due)) label = 'Today'
      else if (isTomorrow(due)) label = 'Tomorrow'
      else label = format(due, 'EEEE, d MMM')

      if (!map.has(dayKey)) map.set(dayKey, { label, items: [] })
      map.get(dayKey)!.items.push(r)
    }
    return [...map.entries()]
  }, [sorted])

  if (sorted.length === 0) return null

  return (
    <div className="space-y-6">
      {groups.map(([dayKey, { label, items }]) => (
        <div key={dayKey}>
          <h3 className={`text-xs font-bold uppercase tracking-wide mb-3 px-1 ${
            isPast(nextDueDate(items[0], new Date())) && !isToday(nextDueDate(items[0], new Date()))
              ? 'text-red-500' : 'text-muted'
          }`}>
            {label}
          </h3>
          <div className="space-y-2">
            {items.map((r) => {
              const note = notes.find((n) => n.id === r.note_id)
              const tasks = note?.lines?.filter((l) => l.type === 'task') || []
              const allDone = tasks.length > 0 && tasks.every((t) => t.checked)
              const due = nextDueDate(r, new Date())

              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    backgroundColor: noteBg(note?.color || 'default', theme === 'dark'),
                    borderColor: noteBorder(note?.color || 'default', theme === 'dark'),
                  }}
                >
                  <div className="p-4">
                    {/* title + time */}
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell size={17} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold leading-snug break-words">
                          {r.title || 'Untitled reminder'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {format(due, 'h:mm a')}
                          </span>
                          {r.repeat_type !== 'none' && (
                            <span className="flex items-center gap-1">
                              <Repeat size={12} />
                              {repeatLabel(r).replace('Repeats ', '')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* tasks from linked note */}
                    {tasks.length > 0 && (
                      <div className="ml-12 space-y-1.5">
                        {tasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                              t.checked ? 'bg-amber-500 border-amber-500' : 'border-muted/40'
                            }`}>
                              {t.checked && <Check size={12} strokeWidth={3} className="text-white" />}
                            </span>
                            <span className={`text-sm ${t.checked ? 'line-through text-muted' : ''}`}>
                              {t.text || '(empty task)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* note preview if no tasks */}
                    {tasks.length === 0 && note && (
                      <div className="ml-12">
                        <p className="text-sm text-muted line-clamp-2">
                          {note.lines.filter((l) => l.text.trim()).map((l) => l.text).join(' · ') || 'Empty note'}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
