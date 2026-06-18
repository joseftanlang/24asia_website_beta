import {
  collection, doc, documentId, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';

// Deterministic ids: one registration / one attendance per user per event.
export const regId = (eventId, uid) => `${eventId}_${uid}`;

// Fetch docs by id list using chunked `in` queries (10 per read query).
export async function getDocsByIds(coll, ids) {
  const out = new Map();
  const unique = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, coll), where(documentId(), 'in', chunk)));
    snap.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
  }
  return out;
}

export const eventRef = (id) => doc(db, 'events', id);
export const userRef = (id) => doc(db, 'users', id);

export function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-SG', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore',
  });
}
