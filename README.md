# 24asia — Volunteer & Training PWA

React + Bootstrap 5 + Firebase. Four Firestore collections (`users`, `events`,
`registrations`, `attendance`), QR attendance, nightly reconciliation, push
notifications, installable PWA.

---

## 1. One-time Firebase setup

1. Create a Firebase project → add a **Web app**.
2. **Authentication** → enable **Google** provider.
   *(Apple: needs a paid Apple Developer account. Enable the Apple provider in
   the console, then uncomment the Apple button in `src/pages/Login.jsx`.)*
3. **Firestore** → create database (region `asia-southeast1` recommended).
4. **Storage** → enable.
5. **Cloud Messaging** → Web Push certificates → generate a **VAPID key pair**.
6. Upgrade to the **Blaze plan** (required for Cloud Functions; the free
   quotas still apply, so expected cost at <500 users is ~$0/month).

## 2. Configure the app

```bash
cp .env.example .env        # fill in the web-app config + VAPID key
```

Also paste the same config values into `public/firebase-messaging-sw.js`
(service workers can't read `.env`; these values are public identifiers, not
secrets).

## 3. Install & run

```bash
npm install
npm run dev                 # local dev

cd functions && npm install # functions deps
```

## 4. Deploy

```bash
npm run build
firebase deploy             # hosting + rules + indexes + functions
```

## 5. Bootstrap the first Manager

No one exists yet to approve the first account, so do it once by hand:

1. Sign in with Google in the app (this creates your `users/{uid}` doc).
2. In Firebase Console → Firestore → your user doc, set:
   - `status` → `approved`
   - `roles` → `["Manager"]` (add `"Volunteer"` too if you like)

Every later member is approved from the in-app **Admin → Users** tab.

---

## How the key flows work

### Capacity (low-cost hard stop)
Each event doc carries `approvedCount`. A manager approval runs a Firestore
**transaction**: read event → if `approvedCount < maxSlots`, approve the
registration, increment the counter, and set `status: closed` when full.
Cost: 1 read + 2 writes per approval, no counting queries. The nightly job
re-checks as a safety net. Volunteer-scanner approvals don't consume slots.

### QR attendance (direct client writes)
The member's QR encodes their `uid`. The scanner page writes
`attendance/{eventId}_{userId}` directly; **security rules** verify (via
`get()` lookups, ~2–3 reads per scan) that:
- the scanned member has an **approved registration** for that event, and
- the scanner is a **Manager** or holds an approved `role: volunteer`
  registration for that same event.

The deterministic doc ID makes re-scans no-ops (the rules forbid updates),
and the scanner shows the member's name after each scan so a screenshot of
someone else's QR is easy to spot.

### Who can scan
A member taps **Apply as volunteer** on an event; a manager approves that
registration. That member (and any Manager) then sees the event in the
**Scan** page's dropdown.

### Nightly maintenance (00:00 SGT, also "Run now" in Admin)
1. Expire events past their date.
2. Close any open event at capacity (safety net).
3. Mark registrations `completed` where attendance exists.
4. Recompute each affected user's `totalHoursVolunteer` /
   `totalHoursStudent` / `attendedEventIds` (training hours come from
   `type: training` events, volunteer hours from `type: event`). Only users
   whose values changed are written.
5. Send 24-hour event reminders via FCM.

### Certificates
Admin → Certificates: find a member by email, upload a PDF. It's stored at
`certificates/{uid}/…`, the URL is appended to the user's `certificates`
array, and a push notification fires automatically.

---

## Cost profile (at <500 users)

| Screen / action | Firestore reads |
|---|---|
| Events page | 1 page query (12 docs) + 1 my-registrations query |
| Dashboard | user doc (already live) + chunked event lookups |
| One QR scan | 1 reg get + 1 user get + ~2 rule `get()`s |
| Manager approval | 1 transactional read |
| Nightly job | a few hundred reads total |

Everything stays comfortably inside the Firebase free tier.

---

## Decisions & known limitations (agreed/flagged during planning)

- **`approvedCount` on events** is the one deliberate denormalized field —
  it's what makes capacity enforcement 1-read cheap.
- **Self-cancel only while pending.** Once approved, a manager must cancel
  (so the slot counter stays correct). Re-applying after a cancel also goes
  through a manager.
- **Hours/stats update nightly**, not instantly after a scan (managers can
  trigger the job manually after an event if members want same-day totals).
- **QR replay risk accepted**: the QR is just the uid; mitigation is the
  scanner seeing the member's name on screen.
- **iOS push**: works on iOS 16.4+ only after the PWA is installed to the
  Home Screen.
- **`pushToken` is a single value** — only the most recent device receives
  pushes. Switch to an array later if multi-device matters.
- **Apple sign-in** is stubbed and one uncomment away once the Apple
  Developer account exists.
