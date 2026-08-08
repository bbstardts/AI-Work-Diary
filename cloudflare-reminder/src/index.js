import webpush from 'web-push';

const VAPID_PUBLIC_KEY = 'BB85Hqh51deHXZQq_G0Fq9fukY3I2HDG36W0IR2Rjd75Tnrd4pDDlIKDgqM4Sfjcs9KMz_ei2SVDPfMI6pph11M';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// The endpoint URL is used as the KV key (safe: it's already a unique, unguessable
// per-device identifier assigned by the browser's push service).
function keyFor(endpoint) {
  return 'sub:' + endpoint;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      const body = await request.json();
      const { endpoint, keys, reminderTime, timezoneOffsetMinutes } = body;
      if (!endpoint || !keys?.p256dh || !keys?.auth || !reminderTime) {
        return json({ error: 'Missing subscription fields' }, 400);
      }
      await env.SUBSCRIPTIONS.put(
        keyFor(endpoint),
        JSON.stringify({
          endpoint,
          keys,
          reminderTime,
          timezoneOffsetMinutes: timezoneOffsetMinutes || 0,
          lastNotifiedDate: null
        })
      );
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/unsubscribe') {
      const { endpoint } = await request.json();
      if (endpoint) await env.SUBSCRIPTIONS.delete(keyFor(endpoint));
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  },

  // Runs automatically every 15 minutes (see wrangler.toml) — no manual trigger needed.
  async scheduled(event, env) {
    const privateKey = env.VAPID_PRIVATE_KEY;
    if (!privateKey) return; // secret not set yet — silently skip until configured

    webpush.setVapidDetails('mailto:support@example.com', VAPID_PUBLIC_KEY, privateKey);

    const list = await env.SUBSCRIPTIONS.list();
    const nowUtc = new Date();

    for (const item of list.keys) {
      const raw = await env.SUBSCRIPTIONS.get(item.name);
      if (!raw) continue;
      const sub = JSON.parse(raw);

      const local = new Date(nowUtc.getTime() + (sub.timezoneOffsetMinutes || 0) * 60000);
      const localDate = local.toISOString().slice(0, 10);
      const localTime = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;

      if (sub.lastNotifiedDate === localDate) continue; // already sent today

      const [rh, rm] = (sub.reminderTime || '18:00').split(':').map(Number);
      const [lh, lm] = localTime.split(':').map(Number);
      const diffMinutes = (lh * 60 + lm) - (rh * 60 + rm);
      if (diffMinutes < 0 || diffMinutes >= 15) continue; // not due in this run's window

      const pushSubscription = { endpoint: sub.endpoint, keys: sub.keys };
      const payload = JSON.stringify({
        title: "Don't forget today's diary entry",
        body: "Take a moment to log today's work."
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sub.lastNotifiedDate = localDate;
        await env.SUBSCRIPTIONS.put(item.name, JSON.stringify(sub));
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await env.SUBSCRIPTIONS.delete(item.name); // expired/unsubscribed device
        }
      }
    }
  }
};
