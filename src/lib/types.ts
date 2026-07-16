// Note content is a list of lines (Google Keep style).
// Each line is one of: heading, text, or checkbox (task).

export type LineType = 'heading' | 'text' | 'task'

export interface NoteLine {
  id: string
  type: LineType
  text: string
  checked?: boolean // only for task lines
}

export type NoteColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink'

export interface Note {
  id: string
  user_id: string
  title: string
  lines: NoteLine[]
  color: NoteColor
  pinned: boolean
  archived: boolean
  trashed: boolean
  trashed_at: string | null
  is_reminder_note: boolean
  collapsed: boolean
  show_checkboxes: boolean
  list_mode: boolean // when true, empty checkbox shown for text lines too
  image_url: string | null
  created_at: string
  updated_at: string
}

export type RepeatType = 'none' | 'weekly' | 'monthly' | 'monthly_day_after'

export interface Reminder {
  id: string
  note_id: string
  user_id: string
  title: string
  due_at: string // ISO datetime
  repeat_type: RepeatType
  repeat_dow: number | null // 0-6 for weekly (0=Sun)
  repeat_dom: number | null // day of month for monthly
  done: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}
