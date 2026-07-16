import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import { useSettings } from '@/context/SettingsContext'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const { settings, updateSettings } = useSettings()

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl bg-surface border border-border overflow-hidden"
        initial={{ y: 30, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Settings size={20} className="text-muted" />
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>

        <div className="px-5 pb-4 space-y-6">
          {/* Heading font size */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Heading font size
              <span className="ml-2 text-muted font-normal">{settings.headingFontSize}px</span>
            </label>

            <input
              type="range"
              min={14}
              max={28}
              step={1}
              value={settings.headingFontSize}
              onChange={(e) => updateSettings({ headingFontSize: Number(e.target.value) })}
              className="w-full accent-amber-500 h-2 bg-border rounded-full appearance-none cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-muted mt-1">
              <span>14px</span>
              <span>28px</span>
            </div>

            {/* Live preview */}
            <div className="mt-3 p-3 rounded-xl bg-bg border border-border">
              <p
                className="font-semibold leading-snug text-text"
                style={{ fontSize: settings.headingFontSize }}
              >
                Preview Heading
              </p>
              <p className="text-sm text-muted mt-1">This is how your note headings will look.</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
