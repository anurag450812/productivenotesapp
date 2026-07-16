import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotesProvider } from './context/NotesContext'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// Android hardware back closes modals / exits
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
          <App />
        </NotesProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
