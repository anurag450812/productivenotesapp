import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotesProvider } from './context/NotesContext'
import { SettingsProvider } from './context/SettingsContext'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    const ev = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(ev)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotesProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </NotesProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
