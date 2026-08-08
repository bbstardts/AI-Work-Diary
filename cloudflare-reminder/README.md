# Work Diary — Background Reminder (Cloudflare Worker)

Free, no credit card, no Base44, no Firebase. Sends a real notification to your
phone even if the app has been closed for days.

## One-time setup (about 5 minutes)

1. Create a free account at https://dash.cloudflare.com/sign-up (email + password, no card).
2. On your computer (or Termux on Android), in this `cloudflare-reminder` folder:
   ```
   npm install
   npx wrangler login
   ```
   This opens a browser tab to connect your Cloudflare account.
3. Create the storage namespace:
   ```
   npx wrangler kv namespace create SUBSCRIPTIONS
   ```
   It prints an `id = "...."` — copy that value into `wrangler.toml`, replacing
   `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.
4. Set the private key as a secret (never put this in code):
   ```
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```
   When it asks for the value, paste:
   ```
   aXzSlHXUW8_TJ73kzgBq1zI13lxLU5UophGm04zwQjU
   ```
5. Deploy it:
   ```
   npx wrangler deploy
   ```
   It prints your live URL, e.g. `https://work-diary-reminder.yourname.workers.dev`.
6. Open `src/lib/push.js` in the main app project and replace `WORKER_URL` at the
   top with that exact URL.
7. Rebuild/redeploy the main app as usual.

That's it — after this, the reminder runs on Cloudflare's servers automatically,
every 15 minutes, forever, for free. No further action needed from you.

## What it does

- The app subscribes your device once (Settings → "Notify me even if I don't
  open the app").
- Every 15 minutes, this Worker checks all subscribed devices; if a device's
  chosen reminder time just passed, it sends a real push notification.
- It has no access to your diary entries, so it reminds you at your set time
  every day, regardless of whether you already wrote today's entry.
