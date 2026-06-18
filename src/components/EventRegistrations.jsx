import { useCallback, useEffect, useState } from 'react';
import {
  collection, doc, getDocs, increment, query, runTransaction, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getDocsByIds } from '../lib/db';
import { cachedQuery, invalidate } from '../lib/cache';

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  completed: 'Attended',
  cancelled: 'Cancelled',
};
const STATUS_CLASS = {
  pending: 'bg-warning',
  approved: 'bg-success',
  completed: 'bg-info',
  cancelled: 'bg-secondary',
};

export default function EventRegistrations({ event, onChange }) {
  const [regs, setRegs] = useState([]);
  const [users, setUsers] = useState(new Map());
  const [busy, setBusy] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await cachedQuery(`event:regs:${event.id}`, async () => {
      const snap = await getDocs(query(
        collection(db, 'registrations'),
        where('eventId', '==', event.id),
      ));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      const usersMap = await getDocsByIds('users', list.map((r) => r.userId));
      return { list, usersMap };
    });
    setRegs(data.list);
    setUsers(data.usersMap);
    setLoaded(true);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const approve = async (reg) => {
    setBusy(reg.id);
    try {
      await runTransaction(db, async (tx) => {
        const regRef = doc(db, 'registrations', reg.id);
        const evRef = doc(db, 'events', event.id);
        const regSnap = await tx.get(regRef);
        const evSnap = await tx.get(evRef);
        if (!regSnap.exists() || !evSnap.exists()) throw new Error('Record no longer exists.');
        if (regSnap.data().status === 'approved') return; // idempotent
        const { approvedCount = 0, maxSlots, status } = evSnap.data();
        if (reg.role === 'attendee') {
          if (status === 'expired') throw new Error('Event is expired.');
          if (approvedCount >= maxSlots) throw new Error('Event is full.');
          const willBeFull = approvedCount + 1 >= maxSlots;
          tx.update(evRef, {
            approvedCount: increment(1),
            ...(willBeFull ? { status: 'closed' } : {}),
          });
        }
        tx.update(regRef, { status: 'approved' });
      });
      invalidate(`event:regs:${event.id}`);
      await load();
      onChange?.();
    } catch (e) { alert(e.message); }
    setBusy('');
  };

  const reject = async (reg) => {
    setBusy(reg.id);
    try {
      await updateDoc(doc(db, 'registrations', reg.id), { status: 'cancelled' });
      invalidate(`event:regs:${event.id}`);
      await load();
      onChange?.();
    } catch (e) { alert(e.message); }
    setBusy('');
  };

  const cancelApproved = async (reg) => {
    const name = users.get(reg.userId)?.name || reg.userId;
    if (!window.confirm(`Cancel ${name}'s registration?\n\nThis frees the slot and re-opens the event if it was full.`)) return;
    setBusy(reg.id);
    try {
      await runTransaction(db, async (tx) => {
        const regRef = doc(db, 'registrations', reg.id);
        const evRef = doc(db, 'events', event.id);
        const regSnap = await tx.get(regRef);
        const evSnap = await tx.get(evRef);
        if (!regSnap.exists() || !evSnap.exists()) throw new Error('Record no longer exists.');
        if (regSnap.data().status !== 'approved') return; // already changed
        if (reg.role === 'attendee') {
          const { status, approvedCount = 0, maxSlots } = evSnap.data();
          const updates = { approvedCount: increment(-1) };
          // Re-open if we were closed because we were at capacity.
          if (status === 'closed' && approvedCount >= maxSlots) updates.status = 'open';
          tx.update(evRef, updates);
        }
        tx.update(regRef, { status: 'cancelled' });
      });
      invalidate(`event:regs:${event.id}`);
      await load();
      onChange?.();
    } catch (e) { alert(e.message); }
    setBusy('');
  };

  if (!loaded) return <div className="border-top pt-3 small text-secondary">Loading registrations…</div>;

  const groups = {
    pending: regs.filter((r) => r.status === 'pending'),
    approved: regs.filter((r) => r.status === 'approved'),
    completed: regs.filter((r) => r.status === 'completed'),
    cancelled: regs.filter((r) => r.status === 'cancelled'),
  };

  const Row = ({ reg }) => {
    const u = users.get(reg.userId);
    return (
      <li className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
        <div className="d-flex align-items-center gap-2">
          {u?.photoUrl
            ? <img src={u.photoUrl} alt="" width="32" height="32" className="rounded-circle object-fit-cover" />
            : <span className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center text-white" style={{ width: 32, height: 32, fontSize: 14 }}>{(u?.name || '?').charAt(0).toUpperCase()}</span>}
          <div>
            <div className="fw-semibold small">{u?.name || reg.userId}</div>
            <div className="text-secondary" style={{ fontSize: '0.75rem' }}>{u?.email}</div>
          </div>
          {reg.role === 'volunteer' && <span className="badge bg-danger ms-1">scanner volunteer</span>}
        </div>
        <div className="d-flex gap-2">
          {reg.status === 'pending' && (
            <>
              <button className="btn btn-sm btn-brand" disabled={busy === reg.id} onClick={() => approve(reg)}>Approve</button>
              <button className="btn btn-sm btn-outline-secondary" disabled={busy === reg.id} onClick={() => reject(reg)}>Reject</button>
            </>
          )}
          {reg.status === 'approved' && (
            <button className="btn btn-sm btn-outline-danger" disabled={busy === reg.id} onClick={() => cancelApproved(reg)}>Cancel</button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="border-top pt-3">
      {regs.length === 0 && <p className="text-secondary small mb-0">Nobody has registered for this yet.</p>}

      {Object.entries(groups).map(([key, list]) => list.length > 0 && (
        <div key={key} className="mb-3">
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className={`badge ${STATUS_CLASS[key]}`}>{STATUS_LABELS[key]}</span>
            <span className="text-secondary small">{list.length}</span>
          </div>
          <ul className="list-group">{list.map((r) => <Row key={r.id} reg={r} />)}</ul>
        </div>
      ))}
    </div>
  );
}
