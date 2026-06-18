import { useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayUnion, collection, doc, getDocs, limit, query, updateDoc, where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';
import { cachedQuery, invalidate } from '../lib/cache';
import ManageEvents from '../components/ManageEvents';

const TABS = ['Users', 'Manage events', 'Certificates', 'Maintenance'];

export default function Admin() {
  const [tab, setTab] = useState('Users');
  return (
    <>
      <h3 className="mb-3">Admin</h3>
      <ul className="nav nav-tabs mb-4">
        {TABS.map((t) => (
          <li className="nav-item" key={t}>
            <button className={`nav-link ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          </li>
        ))}
      </ul>
      {tab === 'Users' && <PendingUsers />}
      {tab === 'Manage events' && <ManageEvents />}
      {tab === 'Certificates' && <Certificates />}
      {tab === 'Maintenance' && <Maintenance />}
    </>
  );
}

/* ---------------- Users ---------------- */
function PendingUsers() {
  const [rows, setRows] = useState([]);
  const [grant, setGrant] = useState({});

  const load = () =>
    cachedQuery('admin:users:pending', async () => {
      const s2 = await getDocs(query(collection(db, 'users'), where('status', '==', 'pending')));
      return s2.docs.map((d) => ({ id: d.id, ...d.data() }));
    }).then(setRows);
  useEffect(() => { load(); }, []);

  const toggle = (uid, role) => setGrant((g) => {
    const set = new Set(g[uid] || []);
    if (set.has(role)) set.delete(role); else set.add(role);
    return { ...g, [uid]: set };
  });

  const approve = async (u) => {
    const roles = [...new Set([...(u.roles || []), ...(grant[u.id] || [])])];
    await updateDoc(doc(db, 'users', u.id), { status: 'approved', roles: roles.length ? roles : ['Volunteer'] });
    invalidate('admin:users');
    load();
  };

  return (
    <>
      <h5>Pending members ({rows.length})</h5>
      {rows.length === 0 && <p className="text-secondary">No one is waiting for approval.</p>}
      <ul className="list-group">
        {rows.map((u) => (
          <li className="list-group-item" key={u.id}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <strong>{u.name || '(no name)'}</strong> <span className="text-secondary small">{u.email}</span>
                <div className="small">Requested: {(u.roles || []).join(', ') || '—'}</div>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="form-check form-check-inline mb-0">
                  <input className="form-check-input" type="checkbox" id={`mgr-${u.id}`}
                    checked={grant[u.id]?.has('Manager') || false} onChange={() => toggle(u.id, 'Manager')} />
                  <label className="form-check-label small" htmlFor={`mgr-${u.id}`}>also Manager</label>
                </div>
                <button className="btn btn-sm btn-brand" onClick={() => approve(u)}>Approve</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------- Certificates ---------------- */
function Certificates() {
  const [allUsers, setAllUsers] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef(null);

  // Load all approved members once per session, then filter client-side.
  useEffect(() => {
    cachedQuery('admin:users:approved', async () => {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('status', '==', 'approved'),
        limit(2000),
      ));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }).then(setAllUsers);
  }, []);

  // Close dropdown when clicking outside.
  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return allUsers.filter((u) =>
      (u.name || '').toLowerCase().includes(term)
      || (u.email || '').toLowerCase().includes(term),
    ).slice(0, 10);
  }, [q, allUsers]);

  const pick = (u) => {
    setSelected(u);
    setQ(`${u.name || u.email}`);
    setShowDrop(false);
  };

  const reset = () => { setSelected(null); setQ(''); setFile(null); setMsg(''); };

  const upload = async () => {
    if (!selected || !file) return;
    setMsg('');
    try {
      const r = ref(storage, `certificates/${selected.id}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, 'users', selected.id), { certificates: arrayUnion(url) });
      setMsg(`Certificate issued to ${selected.name || selected.email}. They'll get a notification.`);
      setFile(null);
      invalidate('admin:users');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="col-lg-7">
      <h5>Issue a certificate</h5>
      {msg && <div className="alert alert-info py-2">{msg}</div>}

      <label className="form-label">Find member by name or email</label>
      <div className="position-relative" ref={wrapRef}>
        <input
          className="form-control"
          value={q}
          onFocus={() => setShowDrop(true)}
          onChange={(e) => { setQ(e.target.value); setSelected(null); setShowDrop(true); }}
          placeholder="Start typing a name or email..."
        />
        {showDrop && matches.length > 0 && (
          <ul className="cert-dropdown list-unstyled">
            {matches.map((u) => (
              <li key={u.id}>
                <button type="button" className="dropdown-row" onClick={() => pick(u)}>
                  {u.photoUrl
                    ? <img src={u.photoUrl} alt="" width="32" height="32" className="rounded-circle object-fit-cover" />
                    : <span className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center text-white" style={{ width: 32, height: 32, fontSize: 14 }}>{(u.name || '?').charAt(0).toUpperCase()}</span>}
                  <div className="text-start">
                    <div className="fw-semibold small">{u.name || '(no name)'}</div>
                    <div className="text-secondary" style={{ fontSize: '0.75rem' }}>{u.email}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showDrop && q.trim() && matches.length === 0 && (
          <div className="cert-dropdown text-secondary small p-3">No matches.</div>
        )}
      </div>

      {selected && (
        <div className="mt-4 p-3 border rounded">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <strong>{selected.name || '(no name)'}</strong>
              <div className="small text-secondary">{selected.email}</div>
              <div className="small text-secondary">{(selected.certificates || []).length} certificate(s) so far</div>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={reset}>Clear</button>
          </div>
          <input type="file" accept="application/pdf" className="form-control my-2" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn btn-brand btn-sm" disabled={!file} onClick={upload}>Upload PDF &amp; issue</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Maintenance ---------------- */
function Maintenance() {
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setOut('Running…');
    try {
      const fn = httpsCallable(functions, 'runMaintenanceNow');
      const res = await fn();
      setOut(JSON.stringify(res.data, null, 2));
    } catch (e) { setOut(e.message); }
    setBusy(false);
  };

  return (
    <div className="col-lg-7">
      <h5>Daily maintenance</h5>
      <p className="text-secondary small">
        Runs automatically every midnight (Singapore time). Run it now to expire past events,
        close full ones, mark scanned registrations completed, and recompute member hours.
      </p>
      <button className="btn btn-brand" disabled={busy} onClick={run}>Run now</button>
      {out && <pre className="mt-3 p-3 border rounded small">{out}</pre>}
    </div>
  );
}
