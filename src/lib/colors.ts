import type { NoteColor } from './types'

interface Palette {
  name: string
  light: string
  dark: string
  border: string
  borderDark: string
}

// Subtle, distinguishable note colors (Google Keep inspired but softer)
export const NOTE_COLORS: Record<NoteColor, Palette> = {
  default: { name: 'Default', light: '#ffffff', dark: '#1e293b', border: '#e2e8f0', borderDark: '#334155' },
  red: { name: 'Coral', light: '#fde8e6', dark: '#4c2a2a', border: '#f5c2bd', borderDark: '#6b3a36' },
  orange: { name: 'Amber', light: '#fdebd8', dark: '#4a3220', border: '#f6c896', borderDark: '#6b4a2c' },
  yellow: { name: 'Sand', light: '#fdf4d3', dark: '#47401f', border: '#f2e08a', borderDark: '#6b6133' },
  green: { name: 'Sage', light: '#e3f3e4', dark: '#243a2a', border: '#b6e0bb', borderDark: '#3d5a48' },
  teal: { name: 'Mint', light: '#d8f0ef', dark: '#1f3b3a', border: '#a6dedb', borderDark: '#385a57' },
  blue: { name: 'Sky', light: '#dceffc', dark: '#1f334d', border: '#a8d4f5', borderDark: '#38567a' },
  purple: { name: 'Lavender', light: '#ece1f7', dark: '#332a4a', border: '#cdb6e8', borderDark: '#50426b' },
  pink: { name: 'Blush', light: '#fbe1ec', dark: '#452238', border: '#f3bcd2', borderDark: '#643a52' }
}

export const COLOR_ORDER: NoteColor[] = [
  'default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'
]

export function noteBg(color: NoteColor, dark: boolean): string {
  return dark ? NOTE_COLORS[color].dark : NOTE_COLORS[color].light
}

export function noteBorder(color: NoteColor, dark: boolean): string {
  return dark ? NOTE_COLORS[color].borderDark : NOTE_COLORS[color].border
}
