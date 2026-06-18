import { useState } from 'react';
import {
  addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { compressImage } from '../lib/images';

function tsToLocalInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({ event, onDone, onCancel }) {
  const isEdit = !!event;
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    type: event?.type || 'event',
    dateTime: tsToLocalInput(event?.dateTime) || '',
    hours: event?.hours ?? 1,
    maxSlots: event?.maxSlots ?? 20,
    status: event?.status || 'open',
  });
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setMsg('');
    if (!form.title.trim() || !form.dateTime) { setMsg('Title and date are required.'); return; }
    if (isEdit && Number(form.maxSlots) < (event.approvedCount || 0)) {
      setMsg(`Max slots can't go below the ${event.approvedCount} already-approved registrations.`);
      return;
    }
    setBusy(true);
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        dateTime: Timestamp.fromDate(new Date(form.dateTime)),
        hours: Number(form.hours),
        maxSlots: Number(form.maxSlots),
        status: form.status,
      };
      let eventId;
      if (isEdit) {
        await updateDoc(doc(db, 'events', event.id), data);
        eventId = event.id;
      } else {
        const created = await addDoc(collection(db, 'events'), {
          ...data,
          imageUrl: '',
          approvedCount: 0,
          createdBy: auth.currentUser?.uid || '',
          createdAt: serverTimestamp(),
        });
        eventId = created.id;
      }
      if (img) {
        const small = await compressImage(img, 1200, 0.8);
        const storageRef = ref(storage, `eventImages/${eventId}/cover`);
        await uploadBytes(storageRef, small, { contentType: 'image/jpeg' });
        await updateDoc(doc(db, 'events', eventId), { imageUrl: await getDownloadURL(storageRef) });
      }
      onDone?.();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const atCapacityWarning = isEdit
    && form.status === 'open'
    && (event?.approvedCount || 0) >= Number(form.maxSlots);

  return (
    <div className="row g-3 border-top pt-3">
      {msg && <div className="col-12"><div className="alert alert-warning py-2 mb-0">{msg}</div></div>}
      <div className="col-md-8">
        <label className="form-label">Title</label>
        <input className="form-control" value={form.title} onChange={set('title')} placeholder="e.g. Beach cleanup at East Coast Park" />
      </div>
      <div className="col-md-4">
        <label className="form-label">{isEdit ? 'Status (manual override)' : 'Status'}</label>
        <select className="form-select" value={form.status} onChange={set('status')}>
          <option value="open">open</option>
          <option value="closed">closed</option>
          {isEdit && <option value="expired">expired</option>}
        </select>
      </div>
      <div className="col-12">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows="4" value={form.description} onChange={set('description')} placeholder="Tell members what to expect..." />
        <div className="form-text small">
          Supports markdown: <code>**bold**</code> · <code>*italic*</code> · <code>[link](https://...)</code> · <code>- list item</code> · blank line for new paragraph.
        </div>
      </div>
      <div className="col-md-3">
        <label className="form-label">Type</label>
        <select className="form-select" value={form.type} onChange={set('type')}>
          <option value="event">event</option>
          <option value="training">training</option>
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label">Date &amp; time (SGT)</label>
        <input type="datetime-local" className="form-control" value={form.dateTime} onChange={set('dateTime')} />
      </div>
      <div className="col-md-2">
        <label className="form-label">Hours</label>
        <input type="number" min="0" step="0.5" className="form-control" value={form.hours} onChange={set('hours')} />
      </div>
      <div className="col-md-2">
        <label className="form-label">Max slots</label>
        <input type="number" min="1" className="form-control" value={form.maxSlots} onChange={set('maxSlots')} />
      </div>
      <div className="col-md-2">
        <label className="form-label">{isEdit ? 'New cover' : 'Cover image'}</label>
        <input type="file" accept="image/*" className="form-control" onChange={(e) => setImg(e.target.files?.[0] || null)} />
      </div>
      <div className="col-12">
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-brand btn-sm" disabled={busy} onClick={save}>
            {isEdit ? 'Save changes' : 'Create event'}
          </button>
          <button className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
        {atCapacityWarning && (
          <div className="small text-warning mt-2">
            Event is at capacity — the nightly job will close it again unless you raise max slots.
          </div>
        )}
      </div>
    </div>
  );
}
