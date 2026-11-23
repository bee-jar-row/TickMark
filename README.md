# TickMark

TickMark ranks a student's homework, quizzes and tests, shows **one reason** for each rank, and **rings and vibrates the phone when a task passes its start-by time** — even when the app is closed.

HCI ENCE616028 · Group 7 · Benintya Farrel Armaya, Rafael Raditya Setyono, Abidzar Rabbani Khatib Harahap

---

## Stack

| Part | Tech | Folder |
|---|---|---|
| Frontend | Vue 3 + Vite (installable PWA, service worker) | `client/` |
| Backend | Node.js 20+ · Express 5 · REST API | `server/` |
| Database | SQLite (`better-sqlite3`), file in `server/data/` | `server/src/db.js` |
| Background alerts | Web Push (VAPID) + scheduler loop | `server/src/scheduler.js`, `client/public/sw.js` |
| Priority Engine | Plain JS module used by **both** client and server | `shared/priority.js` |
| Tests | `node:test` (engine + API) | `server/test/` |
| Deploy | Dockerfile + docker-compose | root |

```
tickmark-app/
├─ shared/priority.js        ← Priority Engine + Reason Generator (one source of truth)
├─ server/
│  ├─ src/index.js           ← starts API + alert scheduler
│  ├─ src/app.js             ← routes, validation
│  ├─ src/db.js              ← SQLite schema
│  ├─ src/push.js            ← Web Push / VAPID keys
│  ├─ src/scheduler.js       ← finds tasks past start-by → push to phone
│  └─ test/                  ← npm test
├─ client/
│  ├─ public/sw.js           ← service worker: shows the notification, Open / Snooze buttons
│  ├─ public/manifest.webmanifest
│  └─ src/
│     ├─ App.vue             ← shell, alert card, toast with Undo
│     ├─ store.js            ← state + actions (every change is undoable)
│     ├─ api.js  alerts.js
│     └─ components/         ← RankedList, TaskDetail, WeekView, forms, Settings
├─ .env.example  Dockerfile  docker-compose.yml
```

## Run it (development)

Needs **Node.js 20 or newer**.

```bash
cp .env.example .env      # optional — every value has a default
npm run setup             # installs root, server and client packages
npm run dev               # API on :3000 + Vue on :5173 (hot reload)
```

Open **http://localhost:5173**. The first visit loads three demo tasks (Essay 2, Lab 5, Quiz 3 — the ones from the wireframe). Tap **Turn on** to allow notifications.

Other commands:

```bash
npm test                  # 11 tests: Priority Engine + API + scheduler
npm run build             # builds client/dist
npm start                 # production: Express serves the API *and* the built app on :3000
docker compose up --build # same, in a container, data kept in a volume
```

## Testing on a real phone

Push notifications need **HTTPS** (plain `localhost` is the only exception). So for a phone:

1. `npm run build && npm start`
2. Open a tunnel to port 3000, for example `npx cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`, and open the `https://…` link on the phone.
3. **Android (Chrome):** tap *Turn on* → allow. Lock the phone and wait: it rings and vibrates at start-by time.
4. **iPhone (iOS 16.4+):** Safari → Share → **Add to Home Screen**, open TickMark from the home screen, then *Turn on*. (iOS only allows web push for installed apps, and it uses its own vibration.)
5. Settings → **Test push** sends one right away.

To see an alert fast: add a task with a deadline 3 hours from now and difficulty *Hard* (6 h × 2 = start-by 12 h before) — the start-by is already past, so the scheduler pushes within 30 s.

## How it maps to our report

| Report item | Where in the app |
|---|---|
| **Type of AI: predictive** | `shared/priority.js` — predicts hours left and start-by time, ranks by urgency. The reason is a fixed template, not generated text. |
| **Modality 1: screen** | Ranked list with one reason per task + Week view |
| **Modality 2: sound + vibration** | `scheduler.js` → Web Push → `sw.js` (`requireInteraction`, vibrate 500-150-200-150-500). In the open app: in-app alert + Web Audio beep. *Quiet class mode* = vibration only. |
| **C1 deadline changed outside app** | **Deadline extended** (date picker, +1 day / +1 week) |
| **C2 progress not reported** | **Already started** (% done slider) |
| **C3 effort from label only** | "Estimated 6 h (from 'hard')" + ✎ to change label or type hours |
| **C4 rule change never entered** | Reason line shows the facts it used; ✎ on deadline; **Undo** |
| **Human-in-the-loop** | ▲▼ reorder → marked "moved by you"; *Use app order again*. Every override is saved on the server and moves the alert time (`RE_ARM` in `app.js`). |
| **Trust** | "How is this list ranked?" shows the formula; detail screen says it is a guess; alerts fire once per start-by and re-arm only when inputs change. |
| **Accessibility** | Urgency = shape + word (▲ START NOW / ● START TODAY / ■ LATER), not colour only; high contrast; bigger text/buttons; ≥ 52 px targets; screen-reader labels, `aria-live` announcements, `alertdialog`, focus trap in sheets, Esc to close, reduced motion. |
| **Recovery** | Undo on every change (toast + button), including Done, Delete, reorder; *Not done yet*; edit any field. |

### The ranking formula

```
effort  = hours you typed, or easy 2 h / medium 4 h / hard 6 h
left    = effort × (100 − % done) / 100
startBy = deadline − left × 2
urgency = (grade % + 5) ÷ hours until startBy      (startBy passed → top of the list)
```

Change `DIFF_HOURS` or `START_FACTOR` in `shared/priority.js` to tune it; client and server both update.

## API

All `/api/*` calls except `health` and `push/key` need the header `X-User-Id` (an anonymous id the app makes per device — no login in this prototype).

| Method | Path | What |
|---|---|---|
| GET | `/api/health` | server check |
| GET | `/api/me` | settings + manual order |
| PUT | `/api/me/settings` | `{ sound, vibrate, silent, hc, big }` |
| PUT | `/api/me/order` | `{ order: [taskId…] }` — student's own order |
| GET | `/api/tasks` | all tasks |
| POST | `/api/tasks` | `{ title, course, deadline, weight, difficulty, hours?, progress? }` |
| PATCH | `/api/tasks/:id` | change some fields (re-arms the alert if deadline/progress/effort/done changed) |
| PUT | `/api/tasks/:id` | full replace / restore (used by Undo) |
| DELETE | `/api/tasks/:id` | delete (returns the task so it can be restored) |
| POST | `/api/tasks/:id/snooze` | `{ minutes }` — ring again later |
| POST | `/api/demo` | reset to the 3 demo tasks |
| GET | `/api/push/key` | VAPID public key |
| POST/DELETE | `/api/push/subscribe` | save / remove this device's push subscription |
| POST | `/api/push/test` | send a test push to all your devices |

## Limits (worth saying in the report)

- No accounts: data belongs to a device id. Clearing the browser makes a new user.
- Web push on iPhone only works after *Add to Home Screen*. For guaranteed alarms with the phone offline, a native app (Capacitor / React Native) with **local** scheduled notifications would be the next step.
- The effort guess still comes from a label (C3); it does not learn how fast this student works.
