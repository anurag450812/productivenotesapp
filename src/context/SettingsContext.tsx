import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface AppSettings {
  headingFontSize: number
}

interface SettingsCtx {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const STORAGE_KEY = 'app-settings'

const defaults: AppSettings = { headingFontSize: 18 }

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {}
  return defaults
}

const Ctx = createContext<SettingsCtx>(null as any)
export const useSettings = () => useContext(Ctx)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  return <Ctx.Provider value={{ settings, updateSettings }}>{children}</Ctx.Provider>
}
