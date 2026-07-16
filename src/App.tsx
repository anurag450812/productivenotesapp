import { useMemo, useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, LayoutGrid, List, Sun, Moon, Archive, Trash2, NotebookPen,
  Bell, X, Pin, RotateCcw, FileX2, Menu, Plus, CheckSquare, Settings
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNotes, TRASH_DAYS } from '@/context/NotesContext'
import { useTheme } from '@/context/ThemeContext'
import type { Note } from '@/lib/types'
import AuthScreen from '@/components/AuthScreen'
import NoteCard from '@/components/NoteCard'
import NoteEditor from '@/components/NoteEditor'
import SettingsPanel from '@/components/SettingsPanel'
import { Capacitor } from '@capacitor/core'

type View = 'notes' | 'archive' | 'trash' | 'reminders'

export default function App() {
  const { user, loading, signOut } = useAuth()
  const { notes, addNote, updateNote, trashNote, restoreNote, deleteForever } = useNotes()
  const { theme, toggle } = useTheme()
  const [view, setView] = useState<View>('notes')
  const [layout, setLayout] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('layout') as 'grid' | 'list') || 'grid'
  )
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => { localStorage.setItem('layout', layout) }, [layout])

  const isTouch = Capacitor.isNativePlatform() || matchMedia('(hover: none)').matches
  const selectionMode = selected.size > 0

  const filtered = useMemo(() => {
    let list = notes
    if (view === 'notes') list = notes.filter((n) => !n.archived && !n.trashed)
    else if (view === 'archive') list = notes.filter((n) => n.archived && !n.trashed)
    else if (view === 'trash') list = notes.filter((n) => n.trashed)
    else if (view === 'reminders') list = notes.filter((n) => n.is_reminder_note && !n.trashed && !n.archived)

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.lines.some((l) => l.text.toLowerCase().includes(q))
      )
    }
    return list
  }, [notes, view, query])

  const pinned = useMemo(() => filtered.filter((n) => n.pinned), [filtered])
  const others = useMemo(() => filtered.filter((n) => !n.pinned), [filtered])
  const openNote = useMemo(() => notes.find((n) => n.id === openId) || null, [notes, openId])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
  }
  if (!user) return <AuthScreen />

  const startQuick = (asReminder = false, asChecklist = false) => {
    const n = addNote({
      is_reminder_note: asReminder,
      show_checkboxes: true,
      ...(asChecklist ? {
        lines: [{ id: Math.random().toString(36).slice(2), type: 'task' as const, text: '', checked: false }]
      } : {})
    })
    setOpenId(n.id)
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const clearSelection = () => setSelected(new Set())
  const setSelection = (s: Set<string>) => setSelected(s)

  const bulk = (fn: (id: string) => void) => {
    selected.forEach(fn)
    clearSelection()
  }

  const uncheck = (id: string) => {
    const n = notes.find((x) => x.id === id)
    if (n) updateNote(id, { lines: n.lines.map((l) => (l.type === 'task' ? { ...l, checked: false } : l)) })
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <TopBar
        query={query} setQuery={setQuery} layout={layout} setLayout={setLayout}
        theme={theme} toggleTheme={toggle} view={view}
        setView={(v: View) => { setView(v); setMenuOpen(false) }}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen} signOut={signOut} email={user.email}
        onSettings={() => setShowSettings(true)}
      />

      {selectionMode && (
        <SelectionBar
          count={selected.size}
          view={view}
          onClear={clearSelection}
          onArchive={() => bulk((id) => updateNote(id, { archived: true }))}
          onTrash={() => bulk(trashNote)}
          onRestore={() => bulk(restoreNote)}
          onDeleteForever={() => bulk(deleteForever)}
          onPin={() => bulk((id) => updateNote(id, { pinned: true }))}
          onUncheck={() => bulk(uncheck)}
        />
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-4 safe-bottom">
        {view === 'notes' && !selectionMode && (
          <div
            className="mb-5 bg-surface border border-border rounded-xl2 shadow-sm flex items-center gap-2 px-4 py-3 cursor-text hover:shadow-md transition-shadow"
            onClick={() => startQuick(false)}
          >
            <Plus size={18} className="text-muted" />
            <span className="text-muted text-sm flex-1">Take a note…</span>
            <button onClick={(e) => { e.stopPropagation(); startQuick(false, true) }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted" title="New checklist note"><CheckSquare size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); startQuick(true) }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted" title="New reminder note"><Bell size={18} /></button>
          </div>
        )}

        {filtered.length === 0 && <EmptyState view={view} />}

        {view === 'notes' && pinned.length > 0 && (
          <Section title="Pinned">
            <NotesGrid notes={pinned} layout={layout} selected={selected} selectionMode={selectionMode}
              onOpen={setOpenId} onToggleSelect={toggleSelect} setSelection={setSelection}
              onLongPress={(id: string) => setSelected(new Set([id]))} isTouch={isTouch} onUpdateNote={updateNote} />
          </Section>
        )}

        {others.length > 0 && (
          <Section title={view === 'notes' && pinned.length > 0 ? 'Others' : ''}>
            <NotesGrid notes={others} layout={layout} selected={selected} selectionMode={selectionMode}
              onOpen={setOpenId} onToggleSelect={toggleSelect} setSelection={setSelection}
              onLongPress={(id: string) => setSelected(new Set([id]))} isTouch={isTouch} onUpdateNote={updateNote} />
          </Section>
        )}

        {view === 'trash' && others.length > 0 && (
          <p className="text-xs text-muted text-center mt-4">Notes in trash are deleted forever after {TRASH_DAYS} days.</p>
        )}
      </main>

      {isTouch && view === 'notes' && !selectionMode && (
        <button onClick={() => startQuick(false)}
          className="fixed bottom-6 right-5 z-30 w-14 h-14 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/40 flex items-center justify-center active:scale-90 transition-transform">
          <Plus size={26} />
        </button>
      )}

      <AnimatePresence>
        {openNote && <NoteEditor note={openNote} onClose={() => setOpenId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </div>
  )
}

function TopBar(props: any) {
  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2">
        <div className="relative flex-1 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search notes"
            className="w-full bg-surface border border-border rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:border-amber-500 transition-colors" />
        </div>
        <button onClick={() => props.setLayout(props.layout === 'grid' ? 'list' : 'grid')}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted" title="Toggle view">
          {props.layout === 'grid' ? <List size={19} /> : <LayoutGrid size={19} />}
        </button>
        <button onClick={props.toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted" title="Toggle theme">
          {props.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <div className="relative">
          <button onClick={() => props.setMenuOpen(!props.menuOpen)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted">
            <Menu size={19} />
          </button>
          {props.menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => props.setMenuOpen(false)} />
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
                {([['notes', 'Notes', NotebookPen], ['reminders', 'Reminders', Bell], ['archive', 'Archive', Archive], ['trash', 'Trash', Trash2]] as const).map(([v, label, Icon]) => (
                  <button key={v} onClick={() => props.setView(v)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${props.view === v ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <Icon size={16} /> {label}
                  </button>
                ))}
                <div className="border-t border-border my-1.5" />
                <button onClick={() => { props.onSettings(); props.setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <Settings size={16} /> Settings
                </button>
                <div className="border-t border-border my-1.5" />
                <div className="px-4 py-1.5 text-xs text-muted truncate">{props.email}</div>
                <button onClick={() => { props.signOut(); props.setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">Sign out</button>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      {title && <h2 className="text-xs font-semibold uppercase tracking-wide text-muted px-1 mb-2">{title}</h2>}
      {children}
    </div>
  )
}

function NotesGrid(props: any) {
  const { notes, layout, selected, selectionMode, onOpen, onToggleSelect, setSelection, onLongPress, isTouch, onUpdateNote } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    if (isTouch || selectionMode) return
    if ((e.target as HTMLElement).closest('[data-note-card]')) return
    startRef.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!startRef.current) return
    const s = startRef.current
    const x = Math.min(s.x, e.clientX), y = Math.min(s.y, e.clientY)
    const w = Math.abs(e.clientX - s.x), h = Math.abs(e.clientY - s.y)
    if (w < 8 && h < 8) { setMarquee(null); return }
    setMarquee({ x, y, w, h })
    const rect = { left: x, top: y, right: x + w, bottom: y + h }
    const next = new Set<string>()
    containerRef.current?.querySelectorAll<HTMLElement>('[data-note-card]').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top) next.add(el.dataset.noteCard!)
    })
    setSelection(next)
  }
  const endDrag = () => { startRef.current = null; setMarquee(null) }

  return (
    <div ref={containerRef}
      className={layout === 'grid' ? 'columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]' : 'flex flex-col gap-2.5'}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}>
      {notes.map((n: Note) => (
        <div key={n.id} data-note-card={n.id} className="break-inside-avoid mb-3">
          <NoteCard note={n} selected={selected.has(n.id)} selectionMode={selectionMode} view={layout}
            onOpen={() => onOpen(n.id)} onToggleSelect={() => onToggleSelect(n.id)} onLongPress={() => onLongPress(n.id)}
            onPin={() => onUpdateNote(n.id, { pinned: !n.pinned })} />
        </div>
      ))}
      {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
    </div>
  )
}

function SelectionBar(props: any) {
  const actions = props.view === 'trash'
    ? [['Restore', RotateCcw, props.onRestore], ['Delete forever', FileX2, props.onDeleteForever]]
    : [['Pin', Pin, props.onPin], ['Uncheck all', CheckSquare, props.onUncheck], ['Archive', Archive, props.onArchive], ['Delete', Trash2, props.onTrash]]
  return (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 inset-x-0 z-30 bg-surface border-b border-border shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2">
        <button onClick={props.onClear} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"><X size={19} /></button>
        <span className="text-sm font-medium">{props.count} selected</span>
        <div className="ml-auto flex items-center gap-1">
          {actions.map(([label, Icon, fn]: any) => (
            <button key={label} onClick={fn} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Icon size={17} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ view }: { view: View }) {
  const map: Record<View, { icon: any; text: string }> = {
    notes: { icon: NotebookPen, text: 'No notes yet. Take your first note above.' },
    archive: { icon: Archive, text: 'Archived notes will appear here.' },
    trash: { icon: Trash2, text: 'Trash is empty.' },
    reminders: { icon: Bell, text: 'No reminder notes. Create a note and enable reminders.' }
  }
  const { icon: Icon, text } = map[view]
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted animate-fade-in-up">
      <Icon size={48} className="mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
