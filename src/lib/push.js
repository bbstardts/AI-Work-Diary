// Real background reminder — sends a push notification even if the app has been
// fully closed for days, via a free Cloudflare Worker (no Base44 account, no
// payment, no Firebase). This is separate from the foreground reminder in
// reminder.js, which only fires while the app happens to be open.
//
// Honest limitation: since this Worker has no access to your diary entries
// (they stay local on your device / in Base44 only), it can't skip you on
// days you've already written — it sends a plain reminder at your chosen
// time, every day.

// Fill this in after deploying the Worker (see cloudflare-reminder/README.md).
const WORKER_URL = 'https://work-diary-reminder.bbstarbobola.workers.dev';

const VAPID_PUBLIC_KEY = 'BB85Hqh51deHXZQq_G0Fq9fukY3I2HDG36W0IR2Rjd75Tnrd4pDDlIKDgqM4Sfjcs9KMz_ei2SVDPfMI6pph11M';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function subscribeToPush(reminderTime) {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this browser.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const json = sub.toJSON();
  const timezoneOffsetMinutes = -new Date().getTimezoneOffset();

  const res = await fetch(`${WORKER_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      reminderTime,
      timezoneOffsetMinutes
    })
  });
  if (!res.ok) throw new Error('Could not reach the reminder service.');
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await fetch(`${WORKER_URL}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
  } catch {
    // Best-effort — unsubscribing locally is what actually stops notifications on this device.
  }
}

export async function isPushSubscribed() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}
