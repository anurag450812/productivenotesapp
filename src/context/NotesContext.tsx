import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Note, Reminder } from '@/lib/types'
import {
  fetchNotes, fetchReminders, upsertNote, upsertReminder, deleteReminder,
  deleteNoteForever as dbDeleteNote, emptyTrash as dbEmptyTrash, updateNotesPositions,
  createBlankNote, createBlankReminder
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { sortRemindersByUpcoming } from '@/lib/reminders'

const TRASH_DAYS = 30
const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000

interface NotesCtx {
  notes: Note[]
  reminders: Reminder[]
  loading: boolean
  // notes ops
  addNote: (overrides?: Partial<Note>) => Note
  updateNote: (id: string, patch: Partial<Note>) => void
  saveNoteNow: (id: string) => Promise<void>
  trashNote: (id: string) => void
  restoreNote: (id: string) => void
  deleteForever: (id: string) => void
  emptyTrashAll: () => Promise<void>
  // reminders ops
  addReminder: (noteId: string, title?: string) => Reminder
  updateReminder: (id: string, patch: Partial<Reminder>) => void
  removeReminder: (id: string) => void
  remindersFor: (noteId: string) => Reminder[]
  sortedRemindersFor: (noteId: string) => Reminder[]
  reorderNotes: (activeId: string, overId: string, section: 'pinned' | 'others' | 'regular' | 'reminder') => void
}

const Ctx = createContext<NotesCtx>(null as any)
export const useNotes = () => useContext(Ctx)

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const dirtyRef = useRef<Set<string>>(new Set())

  // ---- Load ----
  useEffect(() => {
    if (!user) {
      setNotes([])
      setReminders([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([fetchNotes(user.id), fetchReminders(user.id)])
      .then(([n, r]) => {
        setNotes(n)
        setReminders(r)
      })
      .catch((e) => console.error('load error', e))
      .finally(() => setLoading(false))
  }, [user])

  // ---- Realtime ----
  useEffect(() => {
    if (!user) return
    const notesCh = supabase
      .channel('notes_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setNotes((prev) => prev.filter((n) => n.id !== (payload.old as Note).id))
          return
        }
        const row = payload.new as Note
        setNotes((prev) => {
          // skip if we have local pending edits (dirty) for this note
          if (dirtyRef.current.has(row.id)) return prev
          const idx = prev.findIndex((n) => n.id === row.id)
          if (idx === -1) return [row, ...prev]
          const copy = [...prev]
          copy[idx] = row
          return copy
        })
      })
      .subscribe()

    const remCh = supabase
      .channel('reminders_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setReminders((prev) => prev.filter((r) => r.id !== (payload.old as Reminder).id))
          return
        }
        const row = payload.new as Reminder
        setReminders((prev) => {
          const idx = prev.findIndex((r) => r.id === row.id)
          if (idx === -1) return [row, ...prev]
          const copy = [...prev]
          copy[idx] = row
          return copy
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(notesCh)
      supabase.removeChannel(remCh)
    }
  }, [user])

  // ---- optimistic note update + debounced save ----
  const scheduleSave = useCallback((id: string) => {
    dirtyRef.current.add(id)
    const map = debounceRef.current
    if (map.has(id)) clearTimeout(map.get(id)!)
    map.set(
      id,
      setTimeout(async () => {
        const note = notesRef.current.find((n) => n.id === id)
        if (!note) return
        try {
          await upsertNote(note)
        } catch (e) {
          console.error('save note error', e)
        } finally {
          dirtyRef.current.delete(id)
        }
      }, 600)
    )
  }, [])

  const notesRef = useRef<Note[]>([])
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const updateNote = useCallback(
    (id: string, patch: Partial<Note>) => {
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === id)
        if (idx === -1) return prev
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...patch, updated_at: new Date().toISOString() }
        return copy
      })
      scheduleSave(id)
    },
    [scheduleSave]
  )

  const saveNoteNow = useCallback(async (id: string) => {
    const map = debounceRef.current
    if (map.has(id)) {
      clearTimeout(map.get(id)!)
      map.delete(id)
    }
    const note = notesRef.current.find((n) => n.id === id)
    if (!note) return
    dirtyRef.current.add(id)
    try {
      await upsertNote(note)
    } finally {
      dirtyRef.current.delete(id)
    }
  }, [])

  const addNote = useCallback(
    (overrides?: Partial<Note>) => {
      if (!user) return {} as Note
      const maxPos = notesRef.current.reduce((max, n) => Math.max(max, n.position ?? 0), -1)
      const note = createBlankNote(user.id, { position: maxPos + 1, ...overrides })
      setNotes((prev) => [note, ...prev])
      upsertNote(note).catch((e) => console.error('addNote save', e))
      return note
    },
    [user]
  )

  const trashNote = useCallback((id: string) => {
    updateNote(id, { trashed: true, trashed_at: new Date().toISOString(), pinned: false })
    saveNoteNow(id) // immediate persist to avoid race with editor close
  }, [updateNote, saveNoteNow])
  const restoreNote = useCallback((id: string) => updateNote(id, { trashed: false, trashed_at: null }), [updateNote])
  const deleteForever = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await dbDeleteNote(id)
  }, [])
  const emptyTrashAll = useCallback(async () => {
    if (!user) return
    setNotes((prev) => prev.filter((n) => !n.trashed))
    await dbEmptyTrash(user.id)
  }, [user])

  // ---- reminders ----
  const remindersRef = useRef<Reminder[]>([])
  useEffect(() => { remindersRef.current = reminders }, [reminders])

  const addReminder = useCallback((noteId: string, title?: string) => {
    if (!user) return {} as Reminder
    const r = createBlankReminder(noteId, user.id, title)
    setReminders((prev) => [r, ...prev])
    upsertReminder(r).catch((e) => console.error('addReminder', e))
    return r
  }, [user])

  const updateReminder = useCallback((id: string, patch: Partial<Reminder>) => {
    setReminders((prev) => {
      const idx = prev.findIndex((r) => r.id === id)
      if (idx === -1) return prev
      const copy = [...prev]
      copy[idx] = { ...copy[idx], ...patch, updated_at: new Date().toISOString() }
      const target = copy[idx]
      upsertReminder(target).catch((e) => console.error('updateReminder', e))
      return copy
    })
  }, [])

  const removeReminder = useCallback(async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id))
    await deleteReminder(id)
  }, [])

  const remindersFor = useCallback((noteId: string) => reminders.filter((r) => r.note_id === noteId), [reminders])
  const sortedRemindersFor = useCallback(
    (noteId: string) => sortRemindersByUpcoming(reminders.filter((r) => r.note_id === noteId)),
    [reminders]
  )

  const reorderNotes = useCallback(
    (activeId: string, overId: string, section: 'pinned' | 'others' | 'regular' | 'reminder') => {
      if (activeId === overId) return
      setNotes((prev) => {
        let filterFn: (n: Note) => boolean
        if (section === 'pinned') filterFn = (n) => n.pinned
        else if (section === 'reminder') filterFn = (n) => !n.pinned && n.is_reminder_note
        else if (section === 'regular') filterFn = (n) => !n.pinned && !n.is_reminder_note
        else filterFn = (n) => !n.pinned

        const sectionNotes = prev.filter(filterFn)
        const otherNotes = prev.filter((n) => !filterFn(n))

        const oldIndex = sectionNotes.findIndex((n) => n.id === activeId)
        const newIndex = sectionNotes.findIndex((n) => n.id === overId)
        if (oldIndex === -1 || newIndex === -1) return prev

        const reordered = [...sectionNotes]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)

        const reindexed = reordered.map((n, i) => ({ ...n, position: i }))
        const updated = [...otherNotes, ...reindexed]

        const updates = reindexed.map((n) => ({ id: n.id, position: n.position }))
        updateNotesPositions(updates).catch((e) => console.error('reorderNotes save', e))

        return updated
      })
    },
    []
  )

  // Auto-expire trashed notes older than 30 days (clean on load)
  useEffect(() => {
    if (!user) return
    const expired = notes.filter((n) => n.trashed && n.trashed_at && Date.now() - new Date(n.trashed_at).getTime() > TRASH_MS)
    expired.forEach((n) => dbDeleteNote(n.id).catch(() => {}))
  }, [user, notes])

  const value: NotesCtx = {
    notes, reminders, loading,
    addNote, updateNote, saveNoteNow, trashNote, restoreNote, deleteForever, emptyTrashAll,
    addReminder, updateReminder, removeReminder, remindersFor, sortedRemindersFor, reorderNotes
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { TRASH_DAYS }
