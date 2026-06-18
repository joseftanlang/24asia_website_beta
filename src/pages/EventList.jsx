import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp,
  setDoc, startAfter, updateDoc, where,
} from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { regId, fmtDate } from '../lib/db';
import { cachedQuery, invalidate } from '../lib/cache';
import LazyImage from '../components/LazyImage';
import EventDetailsModal from '../components/EventDetailsModal';

const PAGE_SIZES = [12, 18, 24, 30];

const mdComponents = {
  a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
};

function SkeletonGrid({ count = 3 }) {
  return (
    <div className="row g-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="col-12 col-md-6 col-lg-4" key={i}>
          <div className="card h-100">
            <div className="event-img skeleton" />
            <div className="card-body">
              <div className="skeleton skeleton-line" style={{ width: '70%' }} />
              <div className="skeleton skeleton-line" style={{ width: '40%', marginTop: 10, height: 10 }} />
              <div className="skeleton skeleton-line" style={{ width: '90%', marginTop: 16, height: 8 }} />
              <div className="skeleton skeleton-line" style={{ width: '80%', marginTop: 6, height: 8 }} />
              <div className="skeleton skeleton-line" style={{ width: '40%', marginTop: 22, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EventList({ type }) {
  const { user, isApproved } = useAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [myRegs, setMyRegs] = useState({});
  const [busy, setBusy] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(12);
  const [loaded, setLoaded] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(null);

  const title = type === 'training' ? 'Trainings' : 'Events';

  useEffect(() => {
    if (!user) return;
    cachedQuery(`regs:user:${user.uid}`, async () => {
      const snap = await getDocs(query(collection(db, 'registrations'), where('userId', '==', user.uid)));
      const map = {};
      snap.forEach((d) => { map[d.data().eventId] = { id: d.id, ...d.data() }; });
      return map;
    }).then(setMyRegs);
  }, [user]);

  const loadPage = useCallback(async (after) => {
    const fetchPage = async () => {
      const parts = [
        collection(db, 'events'),
        where('type', '==', type),
        where('status', 'in', ['open', 'closed']),
        orderBy('dateTime', 'asc'),
        limit(pageSize),
      ];
      if (after) parts.push(startAfter(after));
      const snap = await getDocs(query(...parts));
      return {
        rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        cursorDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    };
    const data = after
      ? await fetchPage()
      : await cachedQuery(`events:list:${type}:${pageSize}`, fetchPage);
    setItems((prev) => (after ? [...prev, ...data.rows] : data.rows));
    setCursor(data.cursorDoc);
    setHasMore(data.hasMore);
    if (!after) setLoaded(true);
  }, [type, pageSize]);

  useEffect(() => { loadPage(null); }, [loadPage]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((ev) =>
      (ev.title || '').toLowerCase().includes(s)
      || (ev.description || '').toLowerCase().includes(s));
  }, [items, search]);

  // Google Calendar function
  const addToGoogleCalendar = (event) => {
    try {
      let startDate;
      if (event.dateTime?.toDate) {
        startDate = event.dateTime.toDate();
      } else if (event.dateTime) {
        startDate = new Date(event.dateTime);
      } else {
        startDate = new Date();
      }
      
      const endDate = new Date(startDate.getTime() + (event.hours || 1) * 60 * 60 * 1000);
      
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
      };
      
      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);
      
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(event.description || 'Event details')}&location=${encodeURIComponent(event.location || '')}&sf=true&output=xml`;
      
      window.open(url, '_blank');
    } catch (error) {
      console.error('Calendar error:', error);
      alert('Unable to open Google Calendar. Please add it manually.');
    }
  };

  // Register function with Google Calendar prompt
  const register = async (ev, asVolunteer) => {
    setBusy(ev.id);
    try {
      const id = regId(ev.id, user.uid);
      const existing = myRegs[ev.id];
      if (existing && existing.status !== 'cancelled') return;
      if (existing) {
        alert('You cancelled this registration earlier. Ask a manager to re-open it.');
        return;
      }
      const data = {
        userId: user.uid,
        eventId: ev.id,
        status: 'pending',
        role: asVolunteer ? 'volunteer' : 'attendee',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'registrations', id), data);
      setMyRegs((m) => ({ ...m, [ev.id]: { id, ...data, status: 'pending' } }));
      invalidate(`regs:user:${user.uid}`);
      
      // Show Google Calendar prompt after registration
      setShowCalendarPrompt(ev);
    } catch (e) {
      alert(e.message);
    } finally { setBusy(''); }
  };

  // Cancel function - unchanged
  const cancel = async (ev) => {
    const reg = myRegs[ev.id];
    if (!reg) return;
    if (reg.status !== 'pending') {
      alert('This registration is already approved — ask a manager to cancel it so the slot is freed correctly.');
      return;
    }
    setBusy(ev.id);
    try {
      await updateDoc(doc(db, 'registrations', reg.id), { status: 'cancelled' });
      setMyRegs((m) => ({ ...m, [ev.id]: { ...reg, status: 'cancelled' } }));
      invalidate(`regs:user:${user.uid}`);
    } catch (e) { alert(e.message); } finally { setBusy(''); }
  };

  const stop = (e) => e.stopPropagation();

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <h3 className="mb-0">{title}</h3>
        <div className="d-flex gap-2 flex-grow-1 flex-md-grow-0" style={{ maxWidth: 520 }}>
          <input
            type="search"
            className="form-control"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={`Search ${title}`}
          />
          <select
            className="form-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Items per page"
            style={{ width: 'auto' }}
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      </div>

      {!loaded ? (
        <SkeletonGrid count={3} />
      ) : (
        <div className="row g-4">
          {filtered.map((ev) => {
            const reg = myRegs[ev.id];
            const isOpen = ev.status === 'open';
            return (
              <div className="col-12 col-md-6 col-lg-4" key={ev.id}>
                <div
                  className="card h-100 event-card-clickable"
                  onClick={() => setActiveEvent(ev)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveEvent(ev)}
                >
                  {ev.imageUrl ? (
                    <LazyImage src={ev.imageUrl} className="event-img" />
                  ) : (
                    <div className="event-img-empty" aria-hidden="true">
                      {ev.type === 'training' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c0 1.7 3.6 3 6 3s6-1.3 6-3v-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                        </svg>
                      )}
                    </div>
                  )}

                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <h5 className="card-title mb-0">{ev.title}</h5>
                      <span className={`badge badge-${ev.status} flex-shrink-0`}>{ev.status}</span>
                    </div>

                    <div className="card-md-preview flex-grow-1 mb-3">
                      <div className="md-clamp">
                        <ReactMarkdown components={mdComponents}>
                          {ev.description || ''}
                        </ReactMarkdown>
                      </div>
                      <span className="text-brand small fw-medium">Read more →</span>
                    </div>

                    <div className="small text-secondary mb-3">
                      <div>🗓 {fmtDate(ev.dateTime)}</div>
                      <div>⏱ {ev.hours} hour{ev.hours === 1 ? '' : 's'} · {ev.approvedCount ?? 0}/{ev.maxSlots} slots</div>
                    </div>

                    {reg && reg.status !== 'cancelled' ? (
                      <div className="d-flex gap-2 align-items-center flex-wrap" onClick={stop}>
                        <span className={`badge badge-reg-${reg.status}`}>
                          {reg.status}{reg.role === 'volunteer' ? ' · volunteer' : ''}
                        </span>
                        {reg.status === 'pending' && (
                          <button className="btn btn-sm btn-outline-secondary" disabled={busy === ev.id} onClick={() => cancel(ev)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="d-flex gap-2 flex-wrap" onClick={stop}>
                        <button
                          className="btn btn-brand btn-sm"
                          disabled={!isApproved || !isOpen || busy === ev.id}
                          onClick={() => register(ev, false)}
                        >
                          {isOpen ? 'Register' : 'Full'}
                        </button>
                        {type === 'event' && isOpen && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            disabled={!isApproved || busy === ev.id}
                            onClick={() => register(ev, true)}
                            title="Apply to be the attendance scanner for this event"
                          >
                            Apply as volunteer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loaded && filtered.length === 0 && (
        <p className="text-secondary text-center mt-4">
          {search
            ? <>No {title.toLowerCase()} match <strong>&ldquo;{search}&rdquo;</strong>{hasMore ? '. Try loading more below.' : '.'}</>
            : <>No {title.toLowerCase()} yet. Check back soon.</>}
        </p>
      )}

      {hasMore && items.length > 0 && (
        <div className="text-center mt-4">
          <button className="btn btn-outline-secondary" onClick={() => loadPage(cursor)}>Load more</button>
        </div>
      )}

      <EventDetailsModal event={activeEvent} show={!!activeEvent} onClose={() => setActiveEvent(null)} />

      {/* Google Calendar Prompt Modal */}
      {showCalendarPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setShowCalendarPrompt(null)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5 style={{ margin: 0, fontWeight: 600 }}>📅 Add to Google Calendar?</h5>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                onClick={() => setShowCalendarPrompt(null)}
              >
                ×
              </button>
            </div>
            <p>You've successfully registered for <strong>{showCalendarPrompt.title}</strong>!</p>
            <p style={{ fontSize: '0.9rem', color: '#6c757d' }}>⏳ Your registration is pending admin approval.</p>
            <p>Would you like to add this event to your Google Calendar?</p>
            <div style={{ 
              padding: '12px', 
              background: '#f8f9fa', 
              borderRadius: '8px', 
              fontSize: '0.9rem',
              marginBottom: '16px'
            }}>
              <div>📅 {fmtDate(showCalendarPrompt.dateTime)}</div>
              <div>⏱ {showCalendarPrompt.hours} hour{showCalendarPrompt.hours === 1 ? '' : 's'}</div>
              {showCalendarPrompt.location && <div>📍 {showCalendarPrompt.location}</div>}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                style={{ padding: '8px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                onClick={() => setShowCalendarPrompt(null)}
              >
                Skip
              </button>
              <button 
                style={{ padding: '8px 20px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                onClick={() => {
                  addToGoogleCalendar(showCalendarPrompt);
                  setShowCalendarPrompt(null);
                }}
              >
                📅 Add to Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}