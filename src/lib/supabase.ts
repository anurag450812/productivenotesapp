import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key || url.startsWith('your-')) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project values.'
  )
}

// Capacitor-safe storage adapter so auth persists on mobile APK too.
const capacitorStorageAdapter = {
  async getItem(key: string) {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key })
      return value
    }
    return localStorage.getItem(key)
  },
  async setItem(key: string, value: string) {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value })
    } else {
      localStorage.setItem(key, value)
    }
  },
  async removeItem(key: string) {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  }
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: {
    storage: capacitorStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: !Capacitor.isNativePlatform()
  },
  realtime: { params: { eventsPerSecond: 10 } }
})

export const isSupabaseConfigured = !!url && !!key && !url.startsWith('your-')
