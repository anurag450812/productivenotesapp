import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

type Theme = 'light' | 'dark'
interface ThemeCtx {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const Ctx = createContext<ThemeCtx>(null as any)
export const useTheme = () => useContext(Ctx)

async function loadTheme(): Promise<Theme> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: 'theme' })
    return (value as Theme) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  }
  return (localStorage.getItem('theme') as Theme) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    loadTheme().then(setThemeState)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc')
    if (Capacitor.isNativePlatform()) Preferences.set({ key: 'theme', value: theme })
    else localStorage.setItem('theme', theme)
  }, [theme])

  const value: ThemeCtx = {
    theme,
    toggle: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    setTheme: setThemeState
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
