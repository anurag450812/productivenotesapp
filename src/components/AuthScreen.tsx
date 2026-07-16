import { useState } from 'react'
import { motion } from 'framer-motion'
import { NotebookPen, Mail, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fn = mode === 'signin' ? signIn : signUp
    const { error } = await fn(email.trim(), password)
    if (error) setError(error)
    else if (mode === 'signup') setError('Check your email to confirm your account, then sign in.')
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-3">
            <NotebookPen size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Productive Notes</h1>
          <p className="text-sm text-muted mt-1">Notes, reminders & tasks — synced everywhere.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 text-xs rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 p-3">
            Supabase isn't configured. Copy <code>.env.example</code> to <code>.env</code> and add your project URL + anon key.
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex bg-bg rounded-lg p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === m ? 'bg-amber-500 text-white shadow' : 'text-muted'}`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
