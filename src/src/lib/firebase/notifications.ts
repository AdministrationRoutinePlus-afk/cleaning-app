import { getFirebaseMessaging } from './config'
import { getToken, onMessage } from 'firebase/messaging'
import { createClient } from '@/lib/supabase/client'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BM0tTBpSbu8b0Gi1BHCUs_UR-mZS01T5A-p3kGsKmtwRYOEQhme4NP3WgKU-ob4-f_tsuynFGMZC29kSTztQkdU'

// Request notification permission and get FCM token
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('Notifications not supported')
      return null
    }

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Notification permission denied')
      return null
    }

    // Get messaging instance
    const messaging = await getFirebaseMessaging()
    if (!messaging) {
      console.log('Firebase messaging not available')
      return null
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('Service Worker registered:', registration)

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (token) {
      console.log('FCM Token:', token)
      // Save token to database
      await saveFCMToken(token)
      return token
    }

    return null
  } catch (error) {
    console.error('Error getting notification permission:', error)
    return null
  }
}

// Save FCM token to database
async function saveFCMToken(token: string) {
  const supabase = createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if token already exists
    const { data: existing } = await supabase
      .from('fcm_tokens')
      .select('id')
      .eq('user_id', user.id)
      .eq('token', token)
      .single()

    if (existing) {
      // Update last_used
      await supabase
        .from('fcm_tokens')
        .update({ last_used: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      // Insert new token
      await supabase
        .from('fcm_tokens')
        .insert({
          user_id: user.id,
          token,
          device_type: getDeviceType(),
        })
    }
  } catch (error) {
    console.error('Error saving FCM token:', error)
  }
}

// Get device type
function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Mac/.test(ua)) return 'mac'
  if (/Windows/.test(ua)) return 'windows'
  return 'web'
}

// Listen for foreground messages
export async function setupForegroundNotifications(
  onNotification: (payload: { title: string; body: string; data?: Record<string, string> }) => void
) {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return

  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload)

    onNotification({
      title: payload.notification?.title || 'New Notification',
      body: payload.notification?.body || '',
      data: payload.data,
    })
  })
}

// Check if notifications are enabled
export function areNotificationsEnabled(): boolean {
  if (!('Notification' in window)) return false
  return Notification.permission === 'granted'
}

// Check notification permission status
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}
