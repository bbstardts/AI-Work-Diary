// Daily "write today's entry" reminder for Work Diary AI.
//
// Honest limitation: this is a web app, not a native app. A notification fires
// reliably whenever the app is opened or left running in the background tab —
// same moment the check below runs. It cannot guarantee delivery while the app
// has been fully closed for days the way a native app's push notifications can;
// that would require a push-notification server or wrapping the app natively.

const REMINDER_KEY = 'wda_reminder_v1'; // { enabled: bool, time: 'HH:MM' }
const LAST_NOTIFIED_KEY = 'wda_reminder_last_notified_v1'; // 'YYYY-MM-DD'

export function loadReminderSettings() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveReminderSettings(settings) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
}

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function fireNotification() {
  const title = "Don't forget today's diary entry";
  const options = {
    body: "You haven't logged today's work yet — tap to add it.",
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'wda-daily-reminder'
  };
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.showNotification) {
      return reg.showNotification(title, options);
    }
  }
  // Fallback for browsers without an active service worker registration yet.
  new Notification(title, options);
}

// Call this whenever the app opens or comes back to the foreground.
// Fires at most once per day, only after the chosen reminder time, and only
// if today has no entry yet.
export async function checkAndNotify(entries) {
  const settings = loadReminderSettings();
  if (!settings.enabled) return;
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const today = todayStr();
  if (localStorage.getItem(LAST_NOTIFIED_KEY) === today) return; // already notified today

  const [h, m] = (settings.time || '18:00').split(':').map(Number);
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(h, m, 0, 0);
  if (now < reminderTime) return; // not time yet today

  const hasEntryToday = entries.some((e) => e.date === today);
  if (hasEntryToday) return;

  await fireNotification();
  localStorage.setItem(LAST_NOTIFIED_KEY, today);
}
