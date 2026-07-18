import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export type ThemeMode = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

interface ThemeCtx {
  theme: ResolvedTheme
  themeMode: ThemeMode
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>(null as any)
export const useTheme = () => useContext(Ctx)

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

async function loadThemeMode(): Promise<ThemeMode> {
  let stored: string | null = null
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: 'themeMode' })
    stored = value
  } else {
    stored = localStorage.getItem('themeMode')
  }
  if (stored === 'system' || stored === 'light' || stored === 'dark') return stored
  return 'system'
}

const CYCLE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    loadThemeMode().then(setMode)
  }, [])

  // Resolve and apply the theme
  const resolved: ResolvedTheme = mode === 'system' ? getSystemTheme() : mode

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#f8fafc')
    if (Capacitor.isNativePlatform()) Preferences.set({ key: 'themeMode', value: mode })
    else localStorage.setItem('themeMode', mode)
  }, [mode, resolved])

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const root = document.documentElement
      if (mq.matches) root.classList.add('dark')
      else root.classList.remove('dark')
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', mq.matches ? '#0f172a' : '#f8fafc')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  const toggle = useCallback(() => setMode((m) => CYCLE[m]), [])

  const value: ThemeCtx = { theme: resolved, themeMode: mode, toggle }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
