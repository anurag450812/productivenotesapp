import { useMemo, useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, LayoutGrid, List, Sun, Moon, Archive, Trash2, NotebookPen,
  Bell, X, Pin, RotateCcw, FileX2, Plus, CheckSquare, Settings, Check, Monitor
} from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
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
  const { notes, addNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrashAll, reorderNotes } = useNotes()
  const { theme, themeMode, toggle } = useTheme()
  const [view, setView] = useState<View>('notes')
  const [layout, setLayout] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('layout') as 'grid' | 'list') || 'grid'
  )
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [noteRect, setNoteRect] = useState<DOMRect | null>(null)

  // marquee state (lifted to App for full-page coverage)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const selectedRef = useRef(selected)
  const viewRef = useRef(view)
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { viewRef.current = view }, [view])

  // --- Keyboard Delete to trash/deleteForever selected notes ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current.size > 0 && !openId) {
        e.preventDefault()
        if (viewRef.current === 'trash') {
          selectedRef.current.forEach(deleteForever)
        } else {
          selectedRef.current.forEach(trashNote)
        }
        setSelected(new Set())
        setSelectMode(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openId, trashNote, deleteForever])

  useEffect(() => { localStorage.setItem('layout', layout) }, [layout])

  const isTouch = Capacitor.isNativePlatform() || matchMedia('(hover: none)').matches
  const selectionMode = selectMode || selected.size > 0

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // --- Document-level marquee (drag-select from anywhere on page) ---
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (Capacitor.isNativePlatform() || matchMedia('(hover: none)').matches) return
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('input') || target.closest('header') || target.closest('[data-note-editor]')) return
      if (target.closest('[data-note-card]')) return
      if (selectedRef.current.size > 0) {
        setSelected(new Set())
        setSelectMode(false)
      }
      marqueeStartRef.current = { x: e.clientX, y: e.clientY }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!marqueeStartRef.current) return
      const s = marqueeStartRef.current
      const x = Math.min(s.x, e.clientX), y = Math.min(s.y, e.clientY)
      const w = Math.abs(e.clientX - s.x), h = Math.abs(e.clientY - s.y)
      if (w < 8 && h < 8) { setMarquee(null); return }
      setMarquee({ x, y, w, h })
      setSelectMode(true)
      const rect = { left: x, top: y, right: x + w, bottom: y + h }
      const next = new Set<string>()
      document.querySelectorAll<HTMLElement>('[data-note-card]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top) next.add(el.dataset.noteCard!)
      })
      setSelected(next)
    }

    const onPointerUp = () => { marqueeStartRef.current = null; setMarquee(null) }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

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
  const unpinned = useMemo(() => filtered.filter((n) => !n.pinned), [filtered])
  const openNote = useMemo(() => notes.find((n) => n.id === openId) || null, [notes, openId])

  const trashCount = useMemo(() => notes.filter((n) => n.trashed).length, [notes])

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

  const clearSelection = () => { setSelected(new Set()); setSelectMode(false) }

  const selectAll = () => setSelected(new Set(filtered.map((n) => n.id)))

  const bulk = (fn: (id: string) => void) => {
    selected.forEach(fn)
    clearSelection()
  }

  const uncheck = (id: string) => {
    const n = notes.find((x) => x.id === id)
    if (n) updateNote(id, { lines: n.lines.map((l) => (l.type === 'task' ? { ...l, checked: false } : l)) })
  }

  const enterSelectMode = () => {
    setSelectMode(true)
    setSelected(new Set())
  }

  const handleDragEnd = (event: DragEndEvent, section: 'pinned' | 'others') => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderNotes(active.id as string, over.id as string, section)
  }

  const handleNoteOpen = (id: string, rect?: DOMRect) => {
    if (selectionMode) { toggleSelect(id); return }
    setNoteRect(rect || null)
    setOpenId(id)
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <TopBar
        query={query} setQuery={setQuery} layout={layout} setLayout={setLayout}
        themeMode={themeMode} toggleTheme={toggle} view={view}
        setView={(v: View) => { setView(v); setMenuOpen(false); setSelectMode(false); setSelected(new Set()) }}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen} signOut={signOut} email={user.email}
        onSettings={() => setShowSettings(true)}
        selectMode={selectMode} onSelectMode={enterSelectMode} onSelectDone={clearSelection}
      />

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          total={filtered.length}
          view={view}
          onClear={clearSelection}
          onSelectAll={selectAll}
          onArchive={() => bulk((id) => updateNote(id, { archived: true }))}
          onTrash={() => bulk(trashNote)}
          onRestore={() => bulk(restoreNote)}
          onDeleteForever={() => bulk(deleteForever)}
          onPin={() => bulk((id) => updateNote(id, { pinned: true }))}
          onUncheck={() => bulk(uncheck)}
        />
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-4 safe-bottom">
        {/* Take a note bar — always visible in notes view */}
        {view === 'notes' && (
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

        {/* Trash empty button */}
        {view === 'trash' && trashCount > 0 && !selectionMode && (
          <div className="mb-5 flex items-center justify-between">
            <p className="text-xs text-muted">{trashCount} note{trashCount !== 1 ? 's' : ''} in trash · auto-deleted after {TRASH_DAYS} days</p>
            <button
              onClick={() => { if (window.confirm('Delete all notes in trash permanently?')) emptyTrashAll() }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              Empty trash
            </button>
          </div>
        )}

        {filtered.length === 0 && <EmptyState view={view} />}

        {/* Notes view: Pinned → Others (all unpinned together) */}
        {view === 'notes' && pinned.length > 0 && (
          <Section title="Pinned">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'pinned')}>
              <SortableContext items={pinned.map((n) => n.id)} strategy={rectSortingStrategy}>
                <NotesGrid notes={pinned} layout={layout} selected={selected} selectionMode={selectionMode}
                  onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
                  onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} />
              </SortableContext>
            </DndContext>
          </Section>
        )}

        {view === 'notes' && unpinned.length > 0 && (
          <Section title={pinned.length > 0 ? 'Notes' : ''}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'others')}>
              <SortableContext items={unpinned.map((n) => n.id)} strategy={rectSortingStrategy}>
                <NotesGrid notes={unpinned} layout={layout} selected={selected} selectionMode={selectionMode}
                  onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
                  onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} />
              </SortableContext>
            </DndContext>
          </Section>
        )}

        {/* Archive / Reminders tab: show all filtered */}
        {(view === 'archive' || view === 'reminders') && filtered.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'others')}>
            <SortableContext items={filtered.map((n) => n.id)} strategy={rectSortingStrategy}>
              <NotesGrid notes={filtered} layout={layout} selected={selected} selectionMode={selectionMode}
                onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
                onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} />
            </SortableContext>
          </DndContext>
        )}

        {/* Trash view: show trashed notes */}
        {view === 'trash' && filtered.length > 0 && (
          <NotesGrid notes={filtered} layout={layout} selected={selected} selectionMode={selectionMode}
            onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
            onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} />
        )}
      </main>

      {isTouch && view === 'notes' && (
        <button onClick={() => startQuick(false)}
          className="fixed bottom-6 right-5 z-30 w-14 h-14 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/40 flex items-center justify-center active:scale-90 transition-transform">
          <Plus size={26} />
        </button>
      )}

      {/* Selection marquee */}
      {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}

      <AnimatePresence>
        {openNote && <NoteEditor note={openNote} noteRect={noteRect} onClose={() => { setNoteRect(null); setOpenId(null) }} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </div>
  )
}

function TopBar(props: any) {
  const tabs = [
    { key: 'notes', label: 'Notes', Icon: NotebookPen },
    { key: 'reminders', label: 'Reminders', Icon: Bell },
    { key: 'archive', label: 'Archive', Icon: Archive },
    { key: 'trash', label: 'Trash', Icon: Trash2 },
  ] as const

  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-lg border-b border-border">
      {/* Row 1: Search + actions */}
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
        <button onClick={props.toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted" title={`Theme: ${props.themeMode}`}>
          {props.themeMode === 'system' ? <Monitor size={19} /> : props.themeMode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        {props.selectMode ? (
          <button onClick={props.onSelectDone}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors">
            Done
          </button>
        ) : (
          <button onClick={props.onSelectMode}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted" title="Select notes">
            <Check size={19} />
          </button>
        )}
        <div className="relative">
          <button onClick={() => props.setMenuOpen(!props.menuOpen)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          {props.menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => props.setMenuOpen(false)} />
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
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

      {/* Row 2: View tabs */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 flex gap-1 pb-2 overflow-x-auto scrollbar-none">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => props.setView(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              props.view === key
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
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
  const { notes, layout, selected, selectionMode, onOpen, onToggleSelect, onLongPress, isTouch, onUpdateNote } = props

  return (
    <div className={layout === 'grid' ? 'columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]' : 'flex flex-col gap-2.5'}>
      {notes.map((n: Note) => (
        <div key={n.id} data-note-card={n.id} className="break-inside-avoid mb-3">
          <NoteCard note={n} selected={selected.has(n.id)} selectionMode={selectionMode} view={layout}
            onOpen={(rect?: DOMRect) => onOpen(n.id, rect)} onToggleSelect={() => onToggleSelect(n.id)} onLongPress={() => onLongPress(n.id)}
            onPin={() => onUpdateNote(n.id, { pinned: !n.pinned })} />
        </div>
      ))}
    </div>
  )
}

function SelectionBar(props: any) {
  const isTrash = props.view === 'trash'
  const actions = isTrash
    ? [['Restore', RotateCcw, props.onRestore], ['Delete forever', FileX2, props.onDeleteForever]]
    : [['Pin', Pin, props.onPin], ['Uncheck all', CheckSquare, props.onUncheck], ['Archive', Archive, props.onArchive], ['Delete', Trash2, props.onTrash]]

  return (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 inset-x-0 z-30 bg-surface border-b border-border shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2">
        <button onClick={props.onClear} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"><X size={19} /></button>
        <span className="text-sm font-medium">{props.count} selected</span>
        <button onClick={props.onSelectAll} className="text-sm text-amber-500 hover:text-amber-600 ml-2 font-medium">
          {props.count === props.total ? 'Deselect all' : 'Select all'}
        </button>
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
