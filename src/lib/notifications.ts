import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder } from './types'
import { nextDueDate } from './reminders'

let permissionGranted = false
const scheduledIds = new Set<number>()
let listenerHandle: { remove: () => void } | null = null

export async function initNotifications(onNotificationClick: (noteId: string) => void) {
  await requestPermission()
  if (Capacitor.isNativePlatform() && !listenerHandle) {
    listenerHandle = await LocalNotifications.addListener('localNotificationReceived', (notif) => {
      const noteId = (notif as any).extra?.noteId
      if (noteId) onNotificationClick(noteId)
    })
  }
}

export async function requestPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const status = await LocalNotifications.requestPermissions()
    permissionGranted = status.display === 'granted'
  } else if ('Notification' in window) {
    const status = await Notification.requestPermission()
    permissionGranted = status === 'granted'
  }
  return permissionGranted
}

export function isPermissionGranted(): boolean {
  if (Capacitor.isNativePlatform()) return permissionGranted
  if ('Notification' in window) return Notification.permission === 'granted'
  return false
}

function hashId(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2147483647
}

export async function syncReminders(reminders: Reminder[], onNotificationClick: (noteId: string) => void) {
  if (!isPermissionGranted()) return

  const now = Date.now()
  const dueReminders = reminders.filter((r) => {
    if (r.done) return false
    const due = nextDueDate(r)
    return due.getTime() > now
  })

  const activeIds = new Set(dueReminders.map((r) => hashId(r.id)))

  // cancel notifications for completed/removed reminders
  const toCancel = [...scheduledIds].filter((id) => !activeIds.has(id))
  if (toCancel.length > 0) {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) }).catch(() => {})
    }
    toCancel.forEach((id) => scheduledIds.delete(id))
  }

  // schedule new notifications
  for (const r of dueReminders) {
    const notifId = hashId(r.id)
    if (scheduledIds.has(notifId)) continue

    const due = nextDueDate(r)
    const delay = due.getTime() - now
    if (delay < 0 || delay > 7 * 24 * 60 * 60 * 1000) continue // skip if > 7 days away

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [{
          id: notifId,
          title: r.title || 'Reminder',
          body: 'Tap to open note',
          schedule: { at: due },
          extra: { noteId: r.note_id, reminderId: r.id }
        }]
      }).catch(() => {})
    } else {
      // web: use setTimeout + browser Notification
      setTimeout(() => {
        if (Notification.permission !== 'granted') return
        const n = new Notification(r.title || 'Reminder', {
          body: 'Tap to open note',
          tag: r.id
        })
        n.onclick = () => {
          window.focus()
          onNotificationClick(r.note_id)
          n.close()
        }
      }, delay)
    }

    scheduledIds.add(notifId)
  }
}

export async function cancelAll() {
  if (Capacitor.isNativePlatform() && scheduledIds.size > 0) {
    await LocalNotifications.cancel({
      notifications: [...scheduledIds].map((id) => ({ id }))
    }).catch(() => {})
  }
  scheduledIds.clear()
}
