import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, LayoutGrid, List, Sun, Moon, Archive, Trash2, NotebookPen,
  Bell, X, Pin, RotateCcw, FileX2, Plus, CheckSquare, Settings, Check, Monitor, PanelRight
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
import Sidebar from '@/components/Sidebar'
import ReminderPopup from '@/components/ReminderPopup'
import RemindersConsolidated from '@/components/RemindersConsolidated'
import { Capacitor } from '@capacitor/core'
import { requestPermission, syncReminders, isPermissionGranted, initNotifications } from '@/lib/notifications'

type View = 'notes' | 'archive' | 'trash' | 'reminders'

export default function App() {
  const { user, loading, signOut } = useAuth()
  const { notes, reminders, addNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrashAll, reorderNotes } = useNotes()
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
  const scrollPosRef = useRef(0)

  // marquee
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const selectedRef = useRef(selected)
  const selectModeRef = useRef(selectMode)
  const viewRef = useRef(view)
  const notesRef = useRef(notes)
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { selectModeRef.current = selectMode }, [selectMode])
  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => { notesRef.current = notes }, [notes])

  // sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarNotes, setSidebarNotes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sidebarNotes') || '[]') } catch { return [] }
  })
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('sidebarWidth') || '') || 320 } catch { return 320 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragPosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => { localStorage.setItem('sidebarNotes', JSON.stringify(sidebarNotes)) }, [sidebarNotes])

  // debounce sidebar width persistence
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('sidebarWidth', String(sidebarWidth)), 300)
    return () => clearTimeout(t)
  }, [sidebarWidth])

  const isDesktop = useState(() => window.matchMedia('(min-width: 640px)').matches)[0]
  const isTouch = useState(() => Capacitor.isNativePlatform() || matchMedia('(hover: none)').matches)[0]
  const selectionMode = selectMode || selected.size > 0

  // auto-open sidebar when note editor opens (if sidebar has notes) — desktop only
  useEffect(() => {
    if (openId && sidebarNotes.length > 0 && isDesktop) setSidebarOpen(true)
  }, [openId, isDesktop]) // eslint-disable-line react-hooks/exhaustive-deps

  // track pointer during drag for sidebar drop detection
  useEffect(() => {
    const onMove = (e: PointerEvent) => { dragPosRef.current = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => { dragPosRef.current = { x: e.clientX, y: e.clientY } }
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerup', onUp, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [])

  // keyboard delete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current.size > 0 && !openId) {
        e.preventDefault()
        if (viewRef.current === 'trash') selectedRef.current.forEach(deleteForever)
        else {
          const hasPinned = [...selectedRef.current].some((id) => notesRef.current.find((n) => n.id === id)?.pinned)
          if (hasPinned && !window.confirm('Some selected notes are pinned. Move them to trash?')) return
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

  // global escape / hardware back button handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openId) { setNoteRect(null); setOpenId(null) }
        else if (isDesktop && sidebarOpen) setSidebarOpen(false)
        else if (menuOpen) setMenuOpen(false)
        else if (showSettings) setShowSettings(false)
        else if (selected.size > 0 || selectMode) { setSelected(new Set()); setSelectMode(false) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openId, sidebarOpen, menuOpen, showSettings, selected.size, selectMode, isDesktop])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // --- Document-level marquee ---
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (Capacitor.isNativePlatform() || matchMedia('(hover: none)').matches) return
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('input') || target.closest('header') || target.closest('[data-note-editor]')) return
      if (target.closest('[data-note-card]')) return
      // fix: clear selection mode even when selected is empty
      if (selectedRef.current.size > 0 || selectModeRef.current) {
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

  // notification permission request and reminder sync
  const notifRequested = useRef(false)
  const openNoteById = useCallback((noteId: string) => {
    setOpenId(noteId)
    if (isDesktop) setSidebarOpen(true)
  }, [isDesktop])
  useEffect(() => {
    if (!user || notifRequested.current) return
    notifRequested.current = true
    initNotifications(openNoteById)
  }, [user, openNoteById])
  useEffect(() => {
    if (!user || !isPermissionGranted()) return
    syncReminders(reminders, openNoteById)
  }, [reminders, user, openNoteById])

  const filtered = useMemo(() => {
    let list = notes
    if (view === 'notes') list = notes.filter((n) => !n.archived && !n.trashed)
    else if (view === 'archive') list = notes.filter((n) => n.archived && !n.trashed)
    else if (view === 'trash') list = notes.filter((n) => n.trashed)
    else if (view === 'reminders') list = notes.filter((n) => n.is_reminder_note && !n.trashed && !n.archived)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.lines.some((l) => l.text.toLowerCase().includes(q)))
    }
    return list
  }, [notes, view, query])

  const pinned = useMemo(() => filtered.filter((n) => n.pinned), [filtered])
  const unpinned = useMemo(() => filtered.filter((n) => !n.pinned), [filtered])
  const openNote = useMemo(() => notes.find((n) => n.id === openId) || null, [notes, openId])
  const trashCount = useMemo(() => notes.filter((n) => n.trashed).length, [notes])

  // close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu-dropdown]')) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
  if (!user) return <AuthScreen />

  const startQuick = (asReminder = false, asChecklist = false) => {
    const n = addNote({
      is_reminder_note: asReminder,
      show_checkboxes: true,
      ...(asChecklist ? { lines: [{ id: Math.random().toString(36).slice(2), type: 'task' as const, text: '', checked: false }] } : {})
    })
    setOpenId(n.id)
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const clearSelection = () => { setSelected(new Set()); setSelectMode(false) }
  const selectAll = () => setSelected(new Set(filtered.map((n) => n.id)))
  const bulk = (fn: (id: string) => void) => { selected.forEach(fn); clearSelection() }
  const confirmBulkTrash = () => {
    const hasPinned = [...selected].some((id) => notes.find((n) => n.id === id)?.pinned)
    if (hasPinned && !window.confirm('Some selected notes are pinned. Move them to trash?')) return
    bulk(trashNote)
  }
  const uncheck = (id: string) => {
    const n = notes.find((x) => x.id === id)
    if (n) updateNote(id, { lines: n.lines.map((l) => (l.type === 'task' ? { ...l, checked: false } : l)) })
  }
  const enterSelectMode = () => { setSelectMode(true); setSelected(new Set()) }

  const addToSidebar = (id: string) => {
    setSidebarNotes((prev) => prev.includes(id) ? prev : [...prev, id])
    setSidebarOpen(true)
  }
  const removeFromSidebar = (id: string) => setSidebarNotes((prev) => prev.filter((n) => n !== id))
  const reorderSidebar = (newOrder: string[]) => setSidebarNotes(newOrder)
  const bulkAddToSidebar = () => { selected.forEach(addToSidebar); clearSelection() }

  const toggleSidebarTask = (noteId: string, lineId: string) => {
    const note = notes.find((n) => n.id === noteId)
    if (!note) return
    const updatedLines = note.lines.map((l) => l.id === lineId ? { ...l, checked: !l.checked } : l)
    updateNote(noteId, { lines: updatedLines })
  }

  const handleDragEnd = (event: DragEndEvent, section: 'pinned' | 'others') => {
    const { active, over } = event
    setIsDragging(false)
    // sidebar drop only on desktop
    if (isDesktop) {
      const dropThreshold = sidebarOpen ? 320 : 80
      if (dragPosRef.current && window.innerWidth - dragPosRef.current.x < dropThreshold) {
        addToSidebar(active.id as string)
        return
      }
    }
    if (!over || active.id === over.id) return
    reorderNotes(active.id as string, over.id as string, section)
  }

  const handleNoteOpen = (id: string, rect?: DOMRect) => {
    if (selectionMode) { toggleSelect(id); return }
    if (!isDesktop) scrollPosRef.current = window.scrollY
    setNoteRect(rect || null)
    setOpenId(id)
  }

  const onDndStart = () => setIsDragging(true)

  return (
    <div className="min-h-screen bg-bg text-text">
      <TopBar
        query={query} setQuery={setQuery} layout={layout} setLayout={setLayout}
        themeMode={themeMode} toggleTheme={toggle} view={view}
        setView={(v: View) => { setView(v); setMenuOpen(false); setSelectMode(false); setSelected(new Set()) }}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen} signOut={signOut} email={user.email}
        onSettings={() => setShowSettings(true)}
        selectMode={selectMode} onSelectMode={enterSelectMode} onSelectDone={clearSelection}
        sidebarWidth={isDesktop ? sidebarWidth : 0}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        hasSidebarNotes={sidebarNotes.length > 0}
        isDesktop={isDesktop}
      />

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size} total={filtered.length} view={view}
          sidebarWidth={isDesktop ? sidebarWidth : 0}
          onClear={clearSelection} onSelectAll={selectAll}
          onArchive={() => bulk((id) => updateNote(id, { archived: true }))}
          onTrash={confirmBulkTrash} onRestore={() => bulk(restoreNote)}
          onDeleteForever={() => bulk(deleteForever)}
          onPin={() => bulk((id) => updateNote(id, { pinned: true }))}
          onUncheck={() => bulk(uncheck)}
          onSidebar={bulkAddToSidebar}
          isDesktop={isDesktop}
        />
      )}

      <main className="px-3 sm:px-6 pt-4 safe-bottom max-w-6xl mx-auto" style={isDesktop ? { marginRight: sidebarWidth } : undefined}>
        {view === 'notes' && (
          <div className="mb-5 bg-surface border border-border rounded-xl2 shadow-sm flex items-center gap-2 px-4 py-3 cursor-text hover:shadow-md transition-shadow"
            onClick={() => startQuick(false)}>
            <Plus size={18} className="text-muted" />
            <span className="text-muted text-sm flex-1">Take a note…</span>
            <button onClick={(e) => { e.stopPropagation(); startQuick(false, true) }} className="p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center" title="New checklist note"><CheckSquare size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); startQuick(true) }} className="p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center" title="New reminder note"><Bell size={18} /></button>
          </div>
        )}

        {view === 'trash' && trashCount > 0 && !selectionMode && (
          <div className="mb-5 flex items-center justify-between">
            <p className="text-xs text-muted">{trashCount} note{trashCount !== 1 ? 's' : ''} in trash · auto-deleted after {TRASH_DAYS} days</p>
            <button onClick={() => { if (window.confirm('Delete all notes in trash permanently?')) emptyTrashAll() }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">Empty trash</button>
          </div>
        )}

        {filtered.length === 0 && <EmptyState view={view} />}

        {view === 'notes' && pinned.length > 0 && (
          <Section title="Pinned">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDndStart} onDragEnd={(e) => handleDragEnd(e, 'pinned')}>
              <SortableContext items={pinned.map((n) => n.id)} strategy={rectSortingStrategy}>
                <NotesGrid notes={pinned} layout={layout} selected={selected} selectionMode={selectionMode}
                  onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
                  onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} isDesktop={isDesktop} />
              </SortableContext>
            </DndContext>
          </Section>
        )}

        {view === 'notes' && unpinned.length > 0 && (
          <Section title={pinned.length > 0 ? 'Notes' : ''}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDndStart} onDragEnd={(e) => handleDragEnd(e, 'others')}>
              <SortableContext items={unpinned.map((n) => n.id)} strategy={rectSortingStrategy}>
                <NotesGrid notes={unpinned} layout={layout} selected={selected} selectionMode={selectionMode}
                  onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
                  onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} isDesktop={isDesktop} />
              </SortableContext>
            </DndContext>
          </Section>
        )}

        {view === 'archive' && filtered.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDndStart} onDragEnd={(e) => handleDragEnd(e, 'others')}>
            <SortableContext items={filtered.map((n) => n.id)} strategy={rectSortingStrategy}>
              <NotesGrid notes={filtered} layout={layout} selected={selected} selectionMode={selectionMode}
                onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
                onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} isDesktop={isDesktop} />
            </SortableContext>
          </DndContext>
        )}

        {view === 'reminders' && (
          <RemindersConsolidated />
        )}

        {view === 'trash' && filtered.length > 0 && (
          <NotesGrid notes={filtered} layout={layout} selected={selected} selectionMode={selectionMode}
            onOpen={handleNoteOpen} onToggleSelect={toggleSelect}
            onLongPress={(id: string) => { setSelectMode(true); setSelected(new Set([id])) }} isTouch={isTouch} onUpdateNote={updateNote} isDesktop={isDesktop} />
        )}
      </main>

      {isTouch && view === 'notes' && (
        <button onClick={() => startQuick(false)}
          className="fixed bottom-6 right-5 z-30 w-14 h-14 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/40 flex items-center justify-center active:scale-90 transition-transform safe-bottom">
          <Plus size={26} />
        </button>
      )}

      {/* drag-to-sidebar drop zone indicator — desktop only */}
      {isDesktop && isDragging && (
        <div className="fixed right-80 top-0 bottom-0 w-20 z-[42] pointer-events-none flex items-center justify-center">
          <div className="h-2/3 w-1 rounded-full bg-amber-500/30 animate-pulse" />
        </div>
      )}

      {isDesktop && (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} width={sidebarWidth}
          noteIds={sidebarNotes} notes={notes} onRemove={removeFromSidebar} onReorder={reorderSidebar}
          isDragging={isDragging} onToggleTask={toggleSidebarTask} onWidthChange={setSidebarWidth} />
      )}

      <AnimatePresence>
        {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
      </AnimatePresence>

      <AnimatePresence>
        {openNote && <NoteEditor note={openNote} noteRect={isDesktop ? noteRect : null} onClose={() => { setNoteRect(null); setOpenId(null); if (!isDesktop) requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current)) }} onAddToSidebar={isDesktop ? () => addToSidebar(openNote.id) : undefined} sidebarWidth={isDesktop ? sidebarWidth : 0} />}
      </AnimatePresence>

      <ReminderPopup />

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
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-lg border-b border-border safe-top">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2" style={{ paddingRight: Math.max(24, props.sidebarWidth || 0) }}>
        <div className="relative flex-1 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search notes"
            className="w-full bg-surface border border-border rounded-full pl-9 pr-3 py-2.5 text-sm outline-none focus:border-amber-500 transition-colors" />
        </div>
        {props.hasSidebarNotes && props.isDesktop && (
          <button onClick={props.onToggleSidebar}
            className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center" title="Sidebar">
            <PanelRight size={19} />
          </button>
        )}
        {props.isDesktop && (
          <button onClick={() => props.setLayout(props.layout === 'grid' ? 'list' : 'grid')}
            className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center" title="Toggle view">
            {props.layout === 'grid' ? <List size={19} /> : <LayoutGrid size={19} />}
          </button>
        )}
        <button onClick={props.toggleTheme} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center" title={`Theme: ${props.themeMode}`}>
          {props.themeMode === 'system' ? <Monitor size={19} /> : props.themeMode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        {props.selectMode ? (
          <button onClick={props.onSelectDone}
            className="px-3 py-2 rounded-full text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors min-h-[44px]">Done</button>
        ) : (
          <button onClick={props.onSelectMode}
            className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center" title="Select notes">
            <Check size={19} />
          </button>
        )}
        <div className="relative" data-menu-dropdown>
          <button onClick={() => props.setMenuOpen(!props.menuOpen)} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          {props.menuOpen && (
            <motion.div data-menu-dropdown initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
              <button onClick={() => { props.onSettings(); props.setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-h-[44px]">
                <Settings size={16} /> Settings
              </button>
              <div className="border-t border-border my-1.5" />
              <div className="px-4 py-2 text-xs text-muted truncate">{props.email}</div>
              <button onClick={() => { props.signOut(); props.setMenuOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors min-h-[44px]">Sign out</button>
            </motion.div>
          )}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-3 sm:px-6 flex gap-1 pb-2 overflow-x-auto scrollbar-none" style={{ paddingRight: Math.max(24, props.sidebarWidth || 0) }}>
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => props.setView(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              props.view === key ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
            }`}>
            <Icon size={15} />{label}
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
  const { notes, layout, selected, selectionMode, onOpen, onToggleSelect, onLongPress, isTouch, onUpdateNote, isDesktop } = props
  // force list layout on mobile
  const effectiveLayout = isDesktop ? layout : 'list'
  return (
    <div className={effectiveLayout === 'grid' ? 'columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]' : 'flex flex-col gap-2.5'}>
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
    : [
        ...(props.isDesktop ? [['Sidebar', PanelRight, props.onSidebar]] : []),
        ['Pin', Pin, props.onPin], ['Uncheck all', CheckSquare, props.onUncheck], ['Archive', Archive, props.onArchive], ['Delete', Trash2, props.onTrash]
      ]
  return (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 inset-x-0 z-30 bg-surface border-b border-border shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2" style={{ paddingRight: Math.max(24, props.sidebarWidth || 0) }}>
        <button onClick={props.onClear} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={19} /></button>
        <span className="text-sm font-medium">{props.count} selected</span>
        <button onClick={props.onSelectAll} className="text-sm text-amber-500 hover:text-amber-600 ml-2 font-medium min-h-[44px] px-2">
          {props.count === props.total ? 'Deselect all' : 'Select all'}
        </button>
        <div className="ml-auto flex items-center gap-1 overflow-x-auto">
          {actions.map(([label, Icon, fn]: any) => (
            <button key={label} onClick={fn} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors min-h-[44px] whitespace-nowrap">
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
