import { useEffect, useState } from 'react';
import {
  collection, deleteDoc, doc, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fmtDate } from '../lib/db';
import { cachedQuery, invalidate } from '../lib/cache';
import EventForm from './EventForm';
import EventRegistrations from './EventRegistrations';

export default function ManageEvents() {
  const [rows, setRows] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);     // event id
  const [showingRegs, setShowingRegs] = useState(null); // event id
  const [pendingByEvent, setPendingByEvent] = useState({});

  const loadEvents = () =>
    cachedQuery('admin:events:all', async () => {
      const s2 = await getDocs(query(collection(db, 'events'), orderBy('dateTime', 'desc'), limit(100)));
      return s2.docs.map((d) => ({ id: d.id, ...d.data() }));
    }).then(setRows);

  // Single batched query: how many pending registrations per event.
  // Cheap (one read query, single-field index) but gives glanceable badges.
  const loadPendingCounts = () =>
    cachedQuery('admin:regs:pendingCounts', async () => {
      const s2 = await getDocs(query(collection(db, 'registrations'), where('status', '==', 'pending')));
      const counts = {};
      s2.forEach((d) => {
        const id = d.data().eventId;
        counts[id] = (counts[id] || 0) + 1;
      });
      return counts;
    }).then(setPendingByEvent);

  const reloadAll = () => {
    invalidate('admin:events');
    invalidate('admin:regs');
    return Promise.all([loadEvents(), loadPendingCounts()]);
  };
  useEffect(() => { reloadAll(); }, []);

  const remove = async (ev) => {
    const sure = window.confirm(
      `Delete "${ev.title}"?\n\nThis removes the event permanently. Past attendance records are kept as history but stop counting toward hours after the next nightly update.`
    );
    if (!sure) return;
    await deleteDoc(doc(db, 'events', ev.id));
    if (editing === ev.id) setEditing(null);
    if (showingRegs === ev.id) setShowingRegs(null);
    invalidate('events:list:'); // public Events/Trainings pages
    reloadAll();
  };

  const badge = { open: 'badge-open', closed: 'badge-closed', expired: 'badge-expired' };

  const startEdit = (id) => {
    setShowingRegs(null);
    setEditing(editing === id ? null : id);
  };
  const startRegs = (id) => {
    setEditing(null);
    setShowingRegs(showingRegs === id ? null : id);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">All events &amp; trainings ({rows.length})</h5>
        {!creating && (
          <button className="btn btn-brand btn-sm" onClick={() => { setEditing(null); setShowingRegs(null); setCreating(true); }}>
            + Add
          </button>
        )}
      </div>

      {creating && (
        <div className="card p-3 mb-3" style={{ borderColor: 'var(--brand)' }}>
          <h6 className="mb-0">Create a new event or training</h6>
          <EventForm
            event={null}
            onDone={() => { setCreating(false); reloadAll(); }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <ul className="list-group">
        {rows.map((ev) => {
          const pending = pendingByEvent[ev.id] || 0;
          return (
            <li className="list-group-item" key={ev.id}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <strong>{ev.title}</strong>
                  <span className={`badge ${badge[ev.status] || 'badge-closed'} ms-2`}>{ev.status}</span>
                  <span className="badge badge-type ms-1">{ev.type}</span>
                  <div className="small text-secondary">
                    {fmtDate(ev.dateTime)} · {ev.hours}h · {ev.approvedCount ?? 0}/{ev.maxSlots} slots
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => startRegs(ev.id)}>
                    Registrations
                    {pending > 0 && (
                      <span className="badge bg-warning ms-2" style={{ fontSize: '0.7rem' }}>{pending} pending</span>
                    )}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => startEdit(ev.id)}>
                    {editing === ev.id ? 'Close' : 'Edit'}
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(ev)}>Delete</button>
                </div>
              </div>

              {editing === ev.id && (
                <EventForm
                  event={ev}
                  onDone={() => { setEditing(null); reloadAll(); }}
                  onCancel={() => setEditing(null)}
                />
              )}

              {showingRegs === ev.id && (
                <EventRegistrations event={ev} onChange={reloadAll} />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
