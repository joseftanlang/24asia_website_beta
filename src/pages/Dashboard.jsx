import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { cachedQuery } from '../lib/cache';
import { getDocsByIds, fmtDate } from '../lib/db';
import EventDetailsModal from '../components/EventDetailsModal';

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [attended, setAttended] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);

  // Past attended events (from profile's attendedEventIds).
  useEffect(() => {
    const ids = profile?.attendedEventIds || [];
    if (!ids.length) { setAttended([]); return; }
    getDocsByIds('events', ids).then((map) => {
      const rows = [...map.values()].sort(
        (a, b) => (b.dateTime?.seconds || 0) - (a.dateTime?.seconds || 0),
      );
      setAttended(rows);
    });
  }, [profile?.attendedEventIds]);

  // Upcoming events the user is approved for. One cached query for the session.
  useEffect(() => {
    if (!user) return;
    cachedQuery(`dashboard:upcoming:${user.uid}`, async () => {
      const regs = await getDocs(query(
        collection(db, 'registrations'),
        where('userId', '==', user.uid),
        where('status', '==', 'approved'),
      ));
      const ids = regs.docs.map((d) => d.data().eventId);
      if (!ids.length) return [];
      const map = await getDocsByIds('events', ids);
      const now = Date.now();
      return [...map.values()]
        .filter((e) => e.dateTime && e.dateTime.toMillis() > now)
        .sort((a, b) => (a.dateTime?.seconds || 0) - (b.dateTime?.seconds || 0));
    }).then(setUpcoming);
  }, [user]);

  if (!profile) return null;

  const certCount = (profile.certificates || []).length;

  return (
    <>
      <div className="mb-4">
        <h1 className="hero-greeting">Hi, <span className="accent">{profile.name?.split(' ')[0] || 'there'}</span></h1>
        <p className="hero-sub">Here's the impact you've made so far.</p>
      </div>

      <div className="row g-3 mb-5">
        <div className="col-6 col-md-3">
          <div className="card stat-tile">
            <div className="stat-number">{profile.totalHoursVolunteer || 0}</div>
            <div className="stat-label">Volunteer hours</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card stat-tile">
            <div className="stat-number">{profile.totalHoursStudent || 0}</div>
            <div className="stat-label">Training hours</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card stat-tile">
            <div className="stat-number">{(profile.attendedEventIds || []).length}</div>
            <div className="stat-label">Events attended</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card stat-tile">
            <div className="stat-number">{certCount}</div>
            <div className="stat-label">Certificates earned</div>
          </div>
        </div>
      </div>

      <h4 className="mb-3">Upcoming</h4>
      {upcoming.length === 0 && (
        <p className="text-secondary mb-4">Nothing booked yet. Browse Events or Trainings to register.</p>
      )}
      {upcoming.length > 0 && (
        <ul className="list-group mb-5">
          {upcoming.map((ev) => (
            <li
              className="list-group-item d-flex justify-content-between align-items-center timeline-row"
              key={ev.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveEvent(ev)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveEvent(ev)}
            >
              <div>
                <strong>{ev.title}</strong>
                <div className="small text-secondary">{fmtDate(ev.dateTime)} · {ev.type}</div>
              </div>
              <span className="badge badge-open rounded-pill">in {Math.max(1, Math.ceil((ev.dateTime.toMillis() - Date.now()) / 86400000))}d</span>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mb-3">Your timeline</h4>
      {attended.length === 0 && (
        <p className="text-secondary">Nothing here yet — register for an event and get scanned in. Hours appear after the nightly update.</p>
      )}
      {attended.length > 0 && (
        <ul className="list-group">
          {attended.map((ev) => (
            <li
              className="list-group-item d-flex justify-content-between align-items-center timeline-row"
              key={ev.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveEvent(ev)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveEvent(ev)}
            >
              <div>
                <strong>{ev.title}</strong>
                <div className="small text-secondary">{fmtDate(ev.dateTime)} · {ev.type}</div>
              </div>
              <span className="badge bg-danger rounded-pill">{ev.hours}h</span>
            </li>
          ))}
        </ul>
      )}

      <EventDetailsModal event={activeEvent} show={!!activeEvent} onClose={() => setActiveEvent(null)} />
    </>
  );
}
