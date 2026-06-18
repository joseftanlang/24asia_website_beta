import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { regId, getDocsByIds, fmtDate } from '../lib/db';
import { cachedQuery } from '../lib/cache';

function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch { /* audio optional */ }
}

export default function Scan() {
  const { user, isManager } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [running, setRunning] = useState(false);
  const [scans, setScans] = useState([]); // { uid, name, ok, note, at }
  const scannerRef = useRef(null);
  const seenRef = useRef(new Set());
  const busyRef = useRef(false);

  // Which events can I scan for? Cached for the session.
  useEffect(() => {
    const key = isManager ? 'scan:events:manager' : `scan:events:vol:${user.uid}`;
    cachedQuery(key, async () => {
      if (isManager) {
        const snap = await getDocs(query(
          collection(db, 'events'),
          where('status', 'in', ['open', 'closed']),
        ));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const regs = await getDocs(query(
        collection(db, 'registrations'),
        where('userId', '==', user.uid),
        where('role', '==', 'volunteer'),
        where('status', '==', 'approved'),
      ));
      const ids = regs.docs.map((d) => d.data().eventId);
      if (!ids.length) return [];
      const map = await getDocsByIds('events', ids);
      return [...map.values()].filter((e) => e.status !== 'expired');
    }).then(setEvents);
  }, [user, isManager]);

  const handleCode = async (text) => {
    const uid = text.trim();
    if (busyRef.current || seenRef.current.has(uid)) return;
    busyRef.current = true;
    seenRef.current.add(uid);
    try {
      const regSnap = await getDoc(doc(db, 'registrations', regId(eventId, uid)));
      if (!regSnap.exists() || regSnap.data().status !== 'approved') {
        beep(false);
        setScans((s) => [{ uid, name: '', ok: false, note: regSnap.exists() ? `registration is ${regSnap.data().status}` : 'no registration for this event', at: new Date() }, ...s]);
        return;
      }
      // Show who we just scanned (helps spot screenshot/replay misuse).
      let name = uid;
      try {
        const u = await getDoc(doc(db, 'users', uid));
        if (u.exists()) name = u.data().name || uid;
      } catch { /* name optional */ }

      await setDoc(doc(db, 'attendance', regId(eventId, uid)), {
        eventId,
        userId: uid,
        scannedByVolunteerId: user.uid,
        scanTimestamp: serverTimestamp(),
      });
      beep(true);
      setScans((s) => [{ uid, name, ok: true, note: 'checked in', at: new Date() }, ...s]);
    } catch (e) {
      beep(false);
      seenRef.current.delete(uid); // allow retry on transient failure
      setScans((s) => [{ uid, name: '', ok: false, note: e.code === 'permission-denied' ? 'not allowed (already scanned or no approved registration)' : e.message, at: new Date() }, ...s]);
    } finally {
      busyRef.current = false;
    }
  };

  const start = async () => {
    if (!eventId) return;
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      handleCode,
      () => {} // per-frame decode misses are normal; ignore
    );
    setRunning(true);
  };

  const stop = async () => {
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); } catch { /* noop */ }
    setRunning(false);
  };

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  const selected = events.find((e) => e.id === eventId);

  return (
    <>
      <h3 className="mb-3">Scan attendance</h3>
      {events.length === 0 && (
        <div className="alert alert-secondary">
          You're not assigned as a scanning volunteer for any event. Apply as a volunteer on an event and ask a manager to approve you.
        </div>
      )}

      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Event</label>
          <select className="form-select" value={eventId} disabled={running}
            onChange={(e) => { setEventId(e.target.value); seenRef.current = new Set(); setScans([]); }}>
            <option value="">Select an event…</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.dateTime)}</option>)}
          </select>
        </div>
        <div className="col-auto">
          {!running
            ? <button className="btn btn-brand" disabled={!eventId} onClick={start}>Start camera</button>
            : <button className="btn btn-outline-danger" onClick={stop}>Stop</button>}
        </div>
      </div>

      <div id="qr-reader" className={running ? 'mb-3' : 'd-none'} />
      {running && <p className="text-center small text-secondary">Camera stays on — keep scanning. ✓ beep = checked in, low beep = rejected.</p>}

      {selected && (
        <>
          <h6 className="mt-4">Scanned this session ({scans.filter((s) => s.ok).length} checked in)</h6>
          <ul className="list-group">
            {scans.map((s, i) => (
              <li key={i} className={`list-group-item d-flex justify-content-between ${s.ok ? '' : 'list-group-item-danger'}`}>
                <span>{s.ok ? '✅' : '⛔'} {s.name || s.uid}</span>
                <span className="small text-secondary">{s.note} · {s.at.toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
