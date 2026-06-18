/**
 * 24asia Cloud Functions (gen 2, Node 20)
 *
 * - dailyMaintenanceJob : scheduled every midnight Asia/Singapore
 * - runMaintenanceNow   : same job, callable by Managers from the Admin panel
 * - onRegistrationUpdated : push notification on approve / reject
 * - onUserUpdated         : push notification when a certificate is added
 *
 * Designed for <500 users: the nightly job does a full reconcile, which at this
 * scale costs only a few hundred reads per night.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 5 });

/* ---------------------------------------------------------------- helpers */

async function sendPush(token, title, body) {
  if (!token) return;
  try {
    await admin.messaging().send({ token, notification: { title, body } });
  } catch (e) {
    // Stale tokens are normal; never fail the parent operation over a push.
    console.warn('push failed:', e.code || e.message);
  }
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* ----------------------------------------------------------- maintenance */

async function runMaintenance() {
  const now = admin.firestore.Timestamp.now();
  const summary = { expired: 0, closed: 0, completed: 0, usersUpdated: 0, reminders: 0 };

  // Load all non-expired events once (small collection; reused everywhere below).
  const eventsSnap = await db.collection('events').get();
  const events = new Map();
  eventsSnap.forEach((d) => events.set(d.id, { id: d.id, ...d.data() }));

  let batch = db.batch();
  let ops = 0;
  const commit = async (force = false) => {
    if (ops >= 400 || (force && ops > 0)) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  // 1) Expire past events + 2) close full events (safety net behind the
  //    approval-time transaction).
  for (const ev of events.values()) {
    if (ev.status !== 'expired' && ev.dateTime && ev.dateTime.toMillis() < now.toMillis()) {
      batch.update(db.collection('events').doc(ev.id), { status: 'expired' });
      ev.status = 'expired';
      summary.expired += 1; ops += 1;
    } else if (ev.status === 'open' && (ev.approvedCount || 0) >= ev.maxSlots) {
      batch.update(db.collection('events').doc(ev.id), { status: 'closed' });
      ev.status = 'closed';
      summary.closed += 1; ops += 1;
    }
    await commit();
  }

  // 3) Attendance -> mark approved registrations completed.
  //    Attendance doc id === registration doc id === `${eventId}_${userId}`.
  const attendanceSnap = await db.collection('attendance').get();
  const attendanceByUser = new Map(); // userId -> Set(eventId)
  const attendanceIds = [];
  attendanceSnap.forEach((d) => {
    const { userId, eventId } = d.data();
    attendanceIds.push(d.id);
    if (!attendanceByUser.has(userId)) attendanceByUser.set(userId, new Set());
    attendanceByUser.get(userId).add(eventId);
  });

  for (const ids of chunk(attendanceIds, 100)) {
    const regs = await db.getAll(...ids.map((id) => db.collection('registrations').doc(id)));
    for (const reg of regs) {
      if (reg.exists && reg.data().status === 'approved') {
        batch.update(reg.ref, { status: 'completed' });
        summary.completed += 1; ops += 1;
        await commit();
      }
    }
  }
  await commit(true);

  // 4) Recompute stats for every user that has any attendance.
  //    Hours rule: event.type === 'training' -> student hours, else volunteer hours.
  const completedRegs = await db.collection('registrations').where('status', '==', 'completed').get();
  const statsByUser = new Map(); // userId -> { vol, stu }
  completedRegs.forEach((d) => {
    const { userId, eventId } = d.data();
    const ev = events.get(eventId);
    if (!ev) return;
    const s = statsByUser.get(userId) || { vol: 0, stu: 0 };
    if (ev.type === 'training') s.stu += ev.hours || 0;
    else s.vol += ev.hours || 0;
    statsByUser.set(userId, s);
  });

  const affectedUsers = new Set([...attendanceByUser.keys(), ...statsByUser.keys()]);
  for (const ids of chunk([...affectedUsers], 100)) {
    const userDocs = await db.getAll(...ids.map((id) => db.collection('users').doc(id)));
    for (const u of userDocs) {
      if (!u.exists) continue;
      const s = statsByUser.get(u.id) || { vol: 0, stu: 0 };
      const attended = [...(attendanceByUser.get(u.id) || [])].sort();
      const cur = u.data();
      const changed = cur.totalHoursVolunteer !== s.vol
        || cur.totalHoursStudent !== s.stu
        || JSON.stringify([...(cur.attendedEventIds || [])].sort()) !== JSON.stringify(attended);
      if (changed) {
        batch.update(u.ref, {
          totalHoursVolunteer: s.vol,
          totalHoursStudent: s.stu,
          attendedEventIds: attended,
        });
        summary.usersUpdated += 1; ops += 1;
        await commit();
      }
    }
  }
  await commit(true);

  // 5) Reminders for events happening in the next 24h.
  const dayAhead = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
  const upcoming = [...events.values()].filter(
    (e) => e.status !== 'expired' && e.dateTime
      && e.dateTime.toMillis() > now.toMillis() && e.dateTime.toMillis() <= dayAhead.toMillis()
  );
  for (const ev of upcoming) {
    const regs = await db.collection('registrations')
      .where('eventId', '==', ev.id).where('status', '==', 'approved').get();
    const userIds = regs.docs.map((d) => d.data().userId);
    for (const ids of chunk(userIds, 100)) {
      const userDocs = await db.getAll(...ids.map((id) => db.collection('users').doc(id)));
      await Promise.all(userDocs.map((u) => u.exists && sendPush(
        u.data().pushToken,
        'Reminder: ' + ev.title,
        'Happening soon — see you there! Bring your check-in QR.'
      )));
      summary.reminders += userDocs.length;
    }
  }

  console.log('maintenance summary', summary);
  return summary;
}

exports.dailyMaintenanceJob = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Singapore' },
  async () => { await runMaintenance(); }
);

exports.runMaintenanceNow = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const me = await db.collection('users').doc(uid).get();
  const roles = me.exists ? me.data().roles || [] : [];
  if (!roles.includes('Manager') || me.data().status !== 'approved') {
    throw new HttpsError('permission-denied', 'Managers only.');
  }
  return runMaintenance();
});

/* -------------------------------------------------------- notifications */

exports.onRegistrationUpdated = onDocumentUpdated('registrations/{regId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status) return;

  const user = await db.collection('users').doc(after.userId).get();
  if (!user.exists) return;
  const token = user.data().pushToken;

  const ev = await db.collection('events').doc(after.eventId).get();
  const title = ev.exists ? ev.data().title : 'your event';

  if (before.status === 'pending' && after.status === 'approved') {
    await sendPush(token, 'Registration approved 🎉', `You're in for "${title}".`);
  } else if (before.status === 'pending' && after.status === 'cancelled') {
    await sendPush(token, 'Registration update', `Your request for "${title}" was not approved this time.`);
  }
});

exports.onUserUpdated = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Certificate issued.
  if ((after.certificates || []).length > (before.certificates || []).length) {
    await sendPush(after.pushToken, 'Certificate issued 📜', 'A new certificate is on your profile.');
  }
  // Account approved.
  if (before.status === 'pending' && after.status === 'approved') {
    await sendPush(after.pushToken, 'Welcome to 24asia ✅', 'Your account is approved — you can now register for events.');
  }
});
