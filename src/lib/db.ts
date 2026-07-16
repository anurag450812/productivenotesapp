import { supabase, isSupabaseConfigured } from './supabase'
import type { Note, NoteLine, Reminder, NoteColor, RepeatType } from './types'
import { nanoid } from 'nanoid'

function newId() {
  return nanoid(12)
}

export function emptyLine(type: NoteLine['type'] = 'text'): NoteLine {
  return { id: newId(), type, text: '', checked: false }
}

export function createBlankNote(userId: string, overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString()
  return {
    id: newId(),
    user_id: userId,
    title: '',
    lines: [emptyLine('text')],
    color: 'default',
    pinned: false,
    archived: false,
    trashed: false,
    trashed_at: null,
    is_reminder_note: false,
    collapsed: false,
    show_checkboxes: true,
    list_mode: false,
    image_url: null,
    created_at: now,
    updated_at: now,
    ...overrides
  }
}

// ---- Notes CRUD ----

export async function fetchNotes(userId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Note[]
}

export async function upsertNote(note: Note) {
  const payload = { ...note, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('notes').upsert(payload).select().single()
  if (error) throw error
  return data as Note
}

export async function deleteNoteForever(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function emptyTrash(userId: string) {
  const { error } = await supabase.from('notes').delete().eq('user_id', userId).eq('trashed', true)
  if (error) throw error
}

// ---- Reminders ----

export async function fetchReminders(userId: string) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('due_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Reminder[]
}

export async function upsertReminder(r: Reminder) {
  const payload = { ...r, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('reminders').upsert(payload).select().single()
  if (error) throw error
  return data as Reminder
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}

export function createBlankReminder(noteId: string, userId: string, title = ''): Reminder {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  return {
    id: newId(),
    note_id: noteId,
    user_id: userId,
    title,
    due_at: now.toISOString(),
    repeat_type: 'none',
    repeat_dow: null,
    repeat_dom: null,
    done: false,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export type { RepeatType, NoteColor }
export { isSupabaseConfigured }
