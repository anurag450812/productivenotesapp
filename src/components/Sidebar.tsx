import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown, Pin, Check } from 'lucide-react'
import type { Note } from '@/lib/types'
import { useTheme } from '@/context/ThemeContext'
import { noteBg, noteBorder } from '@/lib/colors'

interface Props {
  open: boolean
  onClose: () => void
  noteIds: string[]
  notes: Note[]
  onRemove: (id: string) => void
  isDragging?: boolean
  onToggleTask?: (noteId: string, lineId: string) => void
}

export default function Sidebar({ open, onClose, noteIds, notes, onRemove, isDragging, onToggleTask }: Props) {
  const { theme } = useTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sidebarNotes = noteIds
    .map((id) => notes.find((n) => n.id === id))
    .filter(Boolean) as Note[]

  return (
    <>
      {/* backdrop on mobile */}
      {open && <div className="fixed inset-0 z-[50] bg-black/30 sm:hidden" onClick={onClose} />}

      <AnimatePresence>
        {open && (
          <motion.div
            data-note-editor
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={`fixed right-0 top-0 bottom-0 w-full sm:w-80 z-[51] bg-surface border-l border-border shadow-2xl flex flex-col ${isDragging ? 'pointer-events-none' : ''}`}
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Pin size={14} className="text-amber-500" fill="currentColor" />
                Sidebar
                {sidebarNotes.length > 0 && <span className="text-xs text-muted font-normal">({sidebarNotes.length})</span>}
              </h3>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors">
                <X size={16} />
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
                  <p className="text-xs opacity-60 leading-relaxed">Drag a note card to the right edge of the screen to pin it here for quick reference.</p>
                </div>
              ) : (
                sidebarNotes.map((note) => {
                  const isExpanded = expandedId === note.id
                  const heading = note.title || note.lines.find((l) => l.text.trim())?.text || 'Untitled'
                  const contentLines = note.lines.filter((l) => l.text.trim())

                  return (
                    <motion.div
                      key={note.id}
                      layout
                      className="rounded-xl border overflow-hidden"
                      style={{
                        backgroundColor: noteBg(note.color, theme === 'dark'),
                        borderColor: noteBorder(note.color, theme === 'dark')
                      }}
                    >
                      {/* heading row */}
                      <div className="flex items-stretch">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : note.id)}
                          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-0"
                        >
                          <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="shrink-0">
                            <ChevronRight size={14} className="text-muted" />
                          </motion.span>
                          <span className="text-sm font-medium truncate">{heading}</span>
                        </button>
                        <button
                          onClick={() => onRemove(note.id)}
                          className="px-2 text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 self-center"
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
                                    <span className={l.type === 'task' && l.checked ? 'line-through text-muted' : ''}>
                                      {l.text}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })
              )}
            </div>

            {/* footer */}
            {sidebarNotes.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border shrink-0 text-center">
                <p className="text-[11px] text-muted">Click headings to expand · Reference while editing</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
