import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { cachedQuery } from '../lib/cache';
import { getDocsByIds, fmtDate } from '../lib/db';
import { QRCodeSVG } from 'qrcode.react';
import EventDetailsModal from '../components/EventDetailsModal';

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [attended, setAttended] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [recentCertificates, setRecentCertificates] = useState([]);
  const [isHovered, setIsHovered] = useState(null);
  const [animateStats, setAnimateStats] = useState(false);

  const getRoles = () => {
    const roles = profile?.roles;
    if (!roles) return [];
    if (Array.isArray(roles)) return roles;
    if (typeof roles === 'string') return [roles];
    return [];
  };

  const getRoleColor = () => {
    const roles = getRoles();
    // Default is Yellow (Student)
    if (roles.includes('Manager')) return '#ffffff'; // White
    if (roles.includes('Volunteer Leader')) return '#dc3545'; // Red
    if (roles.includes('Volunteer')) return '#ff8c00'; // Orange
    if (roles.includes('Student')) return '#ffc107'; // Yellow
    return '#ffc107'; // Default Yellow
  };

  const getRoleBadge = () => {
    const roles = getRoles();
    // Default is Yellow (Student)
    if (roles.includes('Manager')) return { label: 'Manager', color: 'bg-white text-dark', icon: '👔' };
    if (roles.includes('Volunteer Leader')) return { label: 'Volunteer Leader', color: 'bg-danger', icon: '⭐' };
    if (roles.includes('Volunteer')) return { label: 'Volunteer', color: 'bg-warning text-dark', icon: '🤝' };
    if (roles.includes('Student')) return { label: 'Student', color: 'bg-warning text-dark', icon: '🎓' };
    return { label: 'Student', color: 'bg-warning text-dark', icon: '🎓' }; // Default Yellow
  };

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

  useEffect(() => {
    const certs = profile?.certificates || [];
    setRecentCertificates(certs.slice(0, 3));
  }, [profile?.certificates]);

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

  useEffect(() => {
    setTimeout(() => setAnimateStats(true), 300);
  }, []);

  if (!profile) return null;

  const roleBadge = getRoleBadge();
  const roleColor = getRoleColor();
  const certCount = (profile.certificates || []).length;
  const totalHours = (profile.totalHoursVolunteer || 0) + (profile.totalHoursStudent || 0);
  const eventsAttended = (profile.attendedEventIds || []).length;
  const hoursProgress = Math.min((totalHours / 100) * 100, 100);
  const eventsProgress = Math.min((eventsAttended / 20) * 100, 100);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 4px' }}>
      {/* ===== HERO SECTION ===== */}
      <div style={{
        background: `linear-gradient(135deg, ${roleColor}22 0%, ${roleColor}11 100%)`,
        borderRadius: '24px',
        padding: '32px 28px',
        marginBottom: '28px',
        border: `1px solid ${roleColor}33`,
        animation: 'fadeInUp 0.8s ease',
        boxShadow: `0 8px 32px ${roleColor}15`,
        transition: 'all 0.3s ease'
      }}>
        <div className="row align-items-center">
          <div className="col-12 col-md-8">
            <div className="d-flex align-items-center gap-3">
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: `4px solid ${roleColor}`,
                padding: '4px',
                flexShrink: 0,
                background: 'var(--bs-body-bg, white)',
                animation: 'pulse 2s ease-in-out infinite',
                boxShadow: `0 0 40px ${roleColor}30`
              }}>
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    backgroundColor: roleColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 700,
                    color: roleColor === '#ffffff' ? '#212529' : 'white'
                  }}>
                    {(profile.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  marginBottom: '4px',
                  color: 'var(--bs-heading-color, #212529)'
                }}>
                  👋 Welcome back, <span style={{
                    color: roleColor,
                    animation: 'colorPulse 3s ease-in-out infinite',
                    background: `linear-gradient(90deg, ${roleColor}, ${roleColor}dd)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {profile.name?.split(' ')[0] || 'there'}!
                  </span>
                </h1>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className={`badge ${roleBadge.color} px-3 py-2`} style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {roleBadge.icon} {roleBadge.label}
                  </span>
                  <span style={{ color: 'var(--bs-secondary-color, #6c757d)', fontSize: '0.9rem' }}>
                    {profile.email}
                  </span>
                </div>
                <p style={{
                  color: 'var(--bs-secondary-color, #6c757d)',
                  marginTop: '8px',
                  fontSize: '1rem',
                  fontWeight: 500
                }}>
                  🌟 Keep learning, keep growing — your journey matters!
                </p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4 mt-3 mt-md-0">
            <div style={{
              background: 'var(--bs-body-bg, white)',
              borderRadius: '20px',
              padding: '20px 24px',
              textAlign: 'center',
              boxShadow: `0 4px 20px ${roleColor}20`,
              border: `1px solid ${roleColor}22`,
              animation: 'slideInRight 0.8s ease'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--bs-secondary-color, #6c757d)', marginBottom: '4px', fontWeight: 600 }}>
                🏆 Impact Score
              </div>
              <div style={{
                fontSize: '3.2rem',
                fontWeight: 800,
                color: roleColor,
                background: `linear-gradient(135deg, ${roleColor}, ${roleColor}88)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {animateStats ? totalHours + eventsAttended * 2 : 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--bs-secondary-color, #6c757d)', marginTop: '4px' }}>
                {totalHours} hours · {eventsAttended} events completed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STATS GRID ===== */}
      <div className="row g-3 mb-4">
        {[
          {
            icon: '⏱️',
            label: 'Total Hours',
            value: totalHours,
            sub: `${profile.totalHoursVolunteer || 0} volunteer · ${profile.totalHoursStudent || 0} training`,
            detail: 'Combined volunteer & training hours'
          },
          {
            icon: '🎯',
            label: 'Events Attended',
            value: eventsAttended,
            sub: `${upcoming.length} upcoming`,
            detail: 'Events you\'ve participated in'
          },
          {
            icon: '📜',
            label: 'Certificates',
            value: certCount,
            sub: certCount > 0 ? `${certCount} earned` : 'Keep going!',
            detail: 'Achievements unlocked'
          },
          {
            icon: '🤝',
            label: 'Volunteer Hours',
            value: profile.totalHoursVolunteer || 0,
            sub: 'Making a difference! 🌍',
            detail: 'Hours given back to community'
          }
        ].map((stat, index) => (
          <div key={index} className="col-6 col-md-3">
            <div
              style={{
                background: 'var(--bs-body-bg, white)',
                borderRadius: '20px',
                padding: '20px 16px',
                textAlign: 'center',
                border: isHovered === index ? `2px solid ${roleColor}` : `1px solid ${roleColor}22`,
                transform: isHovered === index ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: isHovered === index ? `0 12px 40px ${roleColor}30` : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: `fadeInUp 0.6s ease ${index * 0.15}s both`,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={() => setIsHovered(index)}
              onMouseLeave={() => setIsHovered(null)}
            >
              <div style={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 100,
                height: 100,
                background: `radial-gradient(circle, ${roleColor}10, transparent)`,
                borderRadius: '50%'
              }} />
              <div style={{
                fontSize: '2.8rem',
                fontWeight: 800,
                color: roleColor,
                display: 'inline-block',
                transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isHovered === index ? 'scale(1.15) rotate(-5deg)' : 'scale(1) rotate(0deg)'
              }}>
                {animateStats ? stat.value : 0}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--bs-secondary-color, #6c757d)', fontWeight: 600, marginTop: '4px' }}>
                {stat.icon} {stat.label}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--bs-secondary-color, #6c757d)', marginTop: '4px', opacity: 0.7 }}>
                {stat.sub}
              </div>
              <div style={{
                fontSize: '0.6rem',
                color: roleColor,
                marginTop: '6px',
                transition: 'opacity 0.3s ease',
                opacity: isHovered === index ? 1 : 0.5
              }}>
                {stat.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== PROGRESS SECTION ===== */}
      <div className="row g-3 mb-4">
        {[
          {
            icon: '🚀',
            label: 'Learning Journey',
            value: hoursProgress,
            detail: `${totalHours} of 100 hours toward your goal`,
            color: roleColor
          },
          {
            icon: '🏅',
            label: 'Event Completion',
            value: eventsProgress,
            detail: `${eventsAttended} of 20 events toward your next milestone`,
            color: roleColor
          }
        ].map((progress, index) => (
          <div key={index} className="col-12 col-md-6">
            <div style={{
              background: 'var(--bs-body-bg, white)',
              borderRadius: '20px',
              padding: '24px',
              border: `1px solid ${roleColor}22`,
              animation: `fadeInUp 0.6s ease ${(index + 4) * 0.15}s both`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'all 0.3s ease'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 8px 30px ${roleColor}25`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span style={{ fontWeight: 600, color: 'var(--bs-heading-color, #212529)', fontSize: '1.05rem' }}>
                  {progress.icon} {progress.label}
                </span>
                <span style={{
                  fontSize: '1.1rem',
                  color: roleColor,
                  fontWeight: 700,
                  background: `${roleColor}15`,
                  padding: '2px 16px',
                  borderRadius: '20px'
                }}>
                  {Math.round(progress.value)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                background: 'var(--bs-gray-200, #e9ecef)',
                borderRadius: '10px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${progress.value}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${progress.color}, ${progress.color}88)`,
                  borderRadius: '10px',
                  transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  boxShadow: `0 0 20px ${progress.color}30`
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    animation: 'shimmer 2.5s ease-in-out infinite',
                    borderRadius: '10px'
                  }} />
                </div>
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: 'var(--bs-secondary-color, #6c757d)',
                marginTop: '10px',
                fontWeight: 500
              }}>
                {progress.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== QR & QUICK INFO ===== */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-5">
          <div style={{
            background: 'var(--bs-body-bg, white)',
            borderRadius: '20px',
            padding: '24px 20px',
            textAlign: 'center',
            border: `2px solid ${roleColor}33`,
            animation: 'fadeInUp 0.6s ease 0.8s both',
            transition: 'all 0.3s ease',
            boxShadow: `0 4px 20px ${roleColor}10`
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 8px 40px ${roleColor}25`;
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 4px 20px ${roleColor}10`;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <h6 style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--bs-heading-color, #212529)' }}>
              📱 Your QR Code
            </h6>
            <div style={{
              display: 'inline-block',
              padding: '12px',
              background: 'var(--bs-gray-100, #f8f9fa)',
              borderRadius: '16px',
              border: `2px solid ${roleColor}22`,
              transition: 'all 0.3s ease'
            }}>
              <QRCodeSVG value={user.uid} size={150} />
            </div>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--bs-secondary-color, #6c757d)',
              marginTop: '10px',
              marginBottom: 0,
              fontWeight: 500
            }}>
              Show this to scan attendance at events
            </p>
          </div>
        </div>
        <div className="col-12 col-md-7">
          <div style={{
            background: 'var(--bs-body-bg, white)',
            borderRadius: '20px',
            padding: '24px',
            border: `1px solid ${roleColor}22`,
            animation: 'fadeInUp 0.6s ease 0.9s both',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h6 style={{ fontWeight: 700, marginBottom: '16px', color: 'var(--bs-heading-color, #212529)' }}>
              📋 Quick Info
            </h6>
            <div className="row g-2">
              {[
                { icon: '📅', label: 'Member Since', value: profile.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A' },
                { icon: '📞', label: 'Phone', value: profile.phone || 'Not set' },
                { icon: '📜', label: 'Certificates', value: `${certCount} earned` },
                { icon: '📆', label: 'Upcoming', value: `${upcoming.length} events` }
              ].map((info, i) => (
                <div key={i} className="col-6">
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bs-gray-100, #f8f9fa)',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease'
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${roleColor}15`;
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bs-gray-100, #f8f9fa)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--bs-secondary-color, #6c757d)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {info.icon} {info.label}
                    </div>
                    <div style={{
                      fontWeight: 600,
                      color: 'var(--bs-heading-color, #212529)',
                      fontSize: '0.95rem',
                      marginTop: '2px'
                    }}>
                      {info.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== RECENT CERTIFICATES ===== */}
      {recentCertificates.length > 0 && (
        <div className="mb-4" style={{ animation: 'fadeInUp 0.6s ease 1s both' }}>
          <h6 style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--bs-heading-color, #212529)' }}>
            📄 Recent Certificates
          </h6>
          <div className="d-flex flex-wrap gap-2">
            {recentCertificates.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '8px 20px',
                  borderRadius: '30px',
                  background: 'var(--bs-gray-100, #f8f9fa)',
                  color: 'var(--bs-body-color, #212529)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  border: `2px solid ${roleColor}33`,
                  fontWeight: 500,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: `0 2px 8px ${roleColor}10`
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.08)';
                  e.target.style.background = roleColor;
                  e.target.style.color = roleColor === '#ffffff' ? '#212529' : 'white';
                  e.target.style.boxShadow = `0 8px 30px ${roleColor}40`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.background = 'var(--bs-gray-100, #f8f9fa)';
                  e.target.style.color = 'var(--bs-body-color, #212529)';
                  e.target.style.boxShadow = `0 2px 8px ${roleColor}10`;
                }}
              >
                📄 Certificate {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ===== UPCOMING EVENTS ===== */}
      <div className="mb-4" style={{ animation: 'fadeInUp 0.6s ease 1.1s both' }}>
        <h6 style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--bs-heading-color, #212529)' }}>
          📅 Upcoming Events
        </h6>
        {upcoming.length === 0 ? (
          <div style={{
            background: 'var(--bs-body-bg, white)',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            border: `2px dashed ${roleColor}33`,
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <p style={{ color: 'var(--bs-secondary-color, #6c757d)', marginBottom: 0, fontSize: '1.05rem' }}>
              ✨ No upcoming events yet. <br />
              <span style={{ fontSize: '0.9rem' }}>Browse Events or Trainings to register!</span>
            </p>
          </div>
        ) : (
          <div className="list-group">
            {upcoming.map((ev, index) => (
              <div
                key={ev.id}
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                style={{
                  background: 'var(--bs-body-bg, white)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  marginBottom: '10px',
                  border: `1px solid ${roleColor}22`,
                  cursor: 'pointer',
                  animation: `slideInLeft 0.6s ease ${(index + 12) * 0.1}s both`,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px) scale(1.01)';
                  e.currentTarget.style.boxShadow = `0 8px 30px ${roleColor}25`;
                  e.currentTarget.style.borderColor = roleColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = `${roleColor}22`;
                }}
                onClick={() => setActiveEvent(ev)}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--bs-heading-color, #212529)' }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--bs-secondary-color, #6c757d)' }}>
                    📍 {fmtDate(ev.dateTime)} · {ev.type}
                  </div>
                </div>
                <span style={{
                  background: roleColor,
                  color: roleColor === '#ffffff' ? '#212529' : 'white',
                  padding: '6px 18px',
                  borderRadius: '30px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  boxShadow: `0 4px 16px ${roleColor}40`,
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.1)';
                    e.target.style.boxShadow = `0 8px 30px ${roleColor}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = `0 4px 16px ${roleColor}40`;
                  }}
                >
                  {Math.max(1, Math.ceil((ev.dateTime.toMillis() - Date.now()) / 86400000))}d
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== TIMELINE ===== */}
      <div style={{ animation: 'fadeInUp 0.6s ease 1.2s both' }}>
        <h6 style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--bs-heading-color, #212529)' }}>
          📋 Your Timeline
        </h6>
        {attended.length === 0 ? (
          <div style={{
            background: 'var(--bs-body-bg, white)',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            border: `2px dashed ${roleColor}33`
          }}>
            <p style={{ color: 'var(--bs-secondary-color, #6c757d)', marginBottom: 0, fontSize: '1.05rem' }}>
              🌱 Start your journey — <br />
              <span style={{ fontSize: '0.9rem' }}>register for an event and get scanned in!</span>
            </p>
          </div>
        ) : (
          <div className="list-group">
            {attended.map((ev, index) => (
              <div
                key={ev.id}
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                style={{
                  background: 'var(--bs-body-bg, white)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  marginBottom: '10px',
                  border: `1px solid #dc354522`,
                  cursor: 'pointer',
                  animation: `slideInLeft 0.6s ease ${(index + 14) * 0.1}s both`,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px) scale(1.01)';
                  e.currentTarget.style.boxShadow = `0 8px 30px #dc354525`;
                  e.currentTarget.style.borderColor = '#dc3545';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = '#dc354522';
                }}
                onClick={() => setActiveEvent(ev)}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--bs-heading-color, #212529)' }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--bs-secondary-color, #6c757d)' }}>
                    📍 {fmtDate(ev.dateTime)} · {ev.type}
                  </div>
                </div>
                <span style={{
                  background: '#dc3545',
                  color: 'white',
                  padding: '6px 18px',
                  borderRadius: '30px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 16px #dc354540',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.1)';
                    e.target.style.boxShadow = '0 8px 30px #dc354560';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 4px 16px #dc354540';
                  }}
                >
                  {ev.hours}h
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <EventDetailsModal event={activeEvent} show={!!activeEvent} onClose={() => setActiveEvent(null)} />

      {/* ===== ANIMATIONS ===== */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes colorPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        /* Dark mode support */
        .list-group-item {
          background: var(--bs-body-bg, #ffffff) !important;
          color: var(--bs-body-color, #212529) !important;
          border-color: var(--bs-border-color, #dee2e6) !important;
        }
        .list-group-item:hover {
          background: var(--bs-gray-100, #f8f9fa) !important;
        }
        .card {
          background: var(--bs-body-bg, #ffffff) !important;
          color: var(--bs-body-color, #212529) !important;
        }
        .text-secondary {
          color: var(--bs-secondary-color, #6c757d) !important;
        }
        body {
          background: var(--bs-body-bg, #ffffff);
          color: var(--bs-body-color, #212529);
        }
      `}</style>
    </div>
  );
}