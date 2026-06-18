import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getDocsByIds } from '../lib/db';

export default function Champions() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('certifications');
  const [certifications, setCertifications] = useState([]);
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen for real-time updates to user's profile
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        // Update certifications from the profile
        const certs = userData.certificates || [];
        setCertifications(certs);
        
        // Recalculate awards based on updated data
        await calculateAwards(userData);
        setLoading(false);
      }
    });

    // Initial load
    const loadData = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const certs = userData.certificates || [];
          setCertifications(certs);
          await calculateAwards(userData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup listener
    return () => unsubscribe();
  }, [user]);

  const calculateAwards = async (userData) => {
    const awardsList = [];
    const totalHours = (userData.totalHoursVolunteer || 0) + (userData.totalHoursStudent || 0);
    const certs = userData.certificates || [];
    const eventsAttended = certs.length;

    // Get registrations to count events
    const regsSnap = await getDocs(
      query(collection(db, 'registrations'), where('userId', '==', user.uid))
    );
    const registrations = regsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const approvedRegs = registrations.filter(r => r.status === 'approved' || r.status === 'completed');
    const eventsCount = approvedRegs.length;

    // Bronze Award: 10+ hours or 5+ events
    if (totalHours >= 10 || eventsCount >= 5) {
      awardsList.push({
        id: 'bronze',
        title: 'Bronze Volunteer Award',
        date: new Date().toLocaleDateString(),
        issuer: '24Asia',
        icon: '🥉',
        description: `Completed ${totalHours} hours and ${eventsCount} events`,
        tier: 'bronze'
      });
    }

    // Silver Award: 25+ hours or 10+ events
    if (totalHours >= 25 || eventsCount >= 10) {
      awardsList.push({
        id: 'silver',
        title: 'Silver Volunteer Award',
        date: new Date().toLocaleDateString(),
        issuer: '24Asia',
        icon: '🥈',
        description: `Completed ${totalHours} hours and ${eventsCount} events`,
        tier: 'silver'
      });
    }

    // Gold Award: 50+ hours or 20+ events
    if (totalHours >= 50 || eventsCount >= 20) {
      awardsList.push({
        id: 'gold',
        title: 'Gold Volunteer Award',
        date: new Date().toLocaleDateString(),
        issuer: '24Asia',
        icon: '🥇',
        description: `Completed ${totalHours} hours and ${eventsCount} events`,
        tier: 'gold'
      });
    }

    // Leadership Award
    if (userData?.roles?.includes('Volunteer Leader')) {
      awardsList.push({
        id: 'leadership',
        title: 'Leadership Excellence Award',
        date: new Date().toLocaleDateString(),
        issuer: '24Asia',
        icon: '👑',
        description: 'Recognized for outstanding leadership as a Volunteer Leader',
        tier: 'leadership'
      });
    }

    // Community Impact Award: 5+ volunteer hours
    if (userData.totalHoursVolunteer >= 5) {
      awardsList.push({
        id: 'community',
        title: 'Community Impact Award',
        date: new Date().toLocaleDateString(),
        issuer: '24Asia',
        icon: '🌟',
        description: `${userData.totalHoursVolunteer} hours contributed to community service`,
        tier: 'impact'
      });
    }

    // Dedication Award: 3+ events attended
    if (eventsCount >= 3) {
      awardsList.push({
        id: 'dedication',
        title: 'Dedication Award',
        date: new Date().toLocaleDateString(),
        issuer: '24Asia',
        icon: '💪',
        description: `Attended ${eventsCount} events with dedication`,
        tier: 'dedication'
      });
    }

    setAwards(awardsList);
  };

  if (!profile) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const renderCertifications = () => {
    if (certifications.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bs-card-bg, white)',
          borderRadius: '16px',
          border: '2px dashed var(--bs-border-color, #dee2e6)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
          <h5 style={{ color: 'var(--bs-heading-color, #212529)' }}>No Certifications Yet</h5>
          <p style={{ color: 'var(--bs-secondary-color, #6c757d)' }}>
            Complete trainings and events to earn certifications!
          </p>
        </div>
      );
    }

    return (
      <div className="row g-3">
        {certifications.map((cert, index) => (
          <div key={index} className="col-12 col-md-6 col-lg-4">
            <div style={{
              background: 'var(--bs-card-bg, white)',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid var(--bs-border-color, #dee2e6)',
              transition: 'all 0.3s ease',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                width: '100%',
                height: '120px',
                background: 'linear-gradient(135deg, #ffd70022, #ff6b3522)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                fontSize: '48px'
              }}>
                📄
              </div>
              <h6 style={{ 
                fontWeight: 600, 
                color: 'var(--bs-heading-color, #212529)',
                marginBottom: '4px'
              }}>
                Certificate {index + 1}
              </h6>
              <p style={{ 
                fontSize: '0.8rem', 
                color: 'var(--bs-secondary-color, #6c757d)',
                flex: 1,
                marginBottom: '12px'
              }}>
                🗓 Issued on {new Date().toLocaleDateString()}
              </p>
              <a 
                href={cert} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                  color: '#0d1117',
                  border: 'none',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                View Certificate
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAwards = () => {
    if (awards.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bs-card-bg, white)',
          borderRadius: '16px',
          border: '2px dashed var(--bs-border-color, #dee2e6)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
          <h5 style={{ color: 'var(--bs-heading-color, #212529)' }}>No Awards Yet</h5>
          <p style={{ color: 'var(--bs-secondary-color, #6c757d)' }}>
            Keep volunteering and making an impact to earn awards!
            <br />
            <span style={{ fontSize: '0.85rem' }}>💡 Complete events and reach milestones to unlock awards.</span>
          </p>
        </div>
      );
    }

    const tierOrder = { gold: 0, silver: 1, bronze: 2, leadership: 3, impact: 4, dedication: 5 };
    const sortedAwards = [...awards].sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99));

    return (
      <div className="row g-3">
        {sortedAwards.map((award) => (
          <div key={award.id} className="col-12 col-md-6 col-lg-4">
            <div style={{
              background: award.tier === 'gold' 
                ? 'linear-gradient(135deg, #ffd70022, #ffd70011)' 
                : award.tier === 'silver'
                  ? 'linear-gradient(135deg, #c0c0c022, #c0c0c011)'
                  : 'linear-gradient(135deg, #cd7f3222, #cd7f3211)',
              borderRadius: '16px',
              padding: '20px',
              border: award.tier === 'gold' 
                ? '2px solid #ffd70055'
                : award.tier === 'silver'
                  ? '2px solid #c0c0c055'
                  : '2px solid #cd7f3255',
              transition: 'all 0.3s ease',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
              e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                fontSize: '80px',
                opacity: 0.08
              }}>
                {award.icon || '🏆'}
              </div>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>
                {award.icon || '🏆'}
              </div>
              <h6 style={{ 
                fontWeight: 700, 
                color: 'var(--bs-heading-color, #212529)',
                marginBottom: '2px',
                fontSize: '1rem'
              }}>
                {award.title}
              </h6>
              <p style={{ 
                fontSize: '0.8rem', 
                color: 'var(--bs-secondary-color, #6c757d)',
                marginBottom: '4px'
              }}>
                {award.issuer || '24Asia'}
              </p>
              <p style={{ 
                fontSize: '0.75rem', 
                color: 'var(--bs-secondary-color, #6c757d)',
                marginBottom: '12px'
              }}>
                🗓 {award.date || 'Date TBD'}
              </p>
              {award.description && (
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--bs-body-color, #212529)',
                  flex: 1,
                  marginBottom: '12px'
                }}>
                  {award.description}
                </p>
              )}
              <div style={{
                padding: '4px 12px',
                background: award.tier === 'gold' 
                  ? '#ffd70033' 
                  : award.tier === 'silver'
                    ? '#c0c0c033'
                    : '#cd7f3233',
                borderRadius: '20px',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: award.tier === 'gold' 
                  ? '#b8860b' 
                  : award.tier === 'silver'
                    ? '#808080'
                    : '#8B4513',
                alignSelf: 'flex-start',
                border: '1px solid ' + (award.tier === 'gold' 
                  ? '#ffd70044' 
                  : award.tier === 'silver'
                    ? '#c0c0c044'
                    : '#cd7f3244')
              }}>
                {award.tier === 'gold' && '🥇 Gold'}
                {award.tier === 'silver' && '🥈 Silver'}
                {award.tier === 'bronze' && '🥉 Bronze'}
                {award.tier === 'leadership' && '👑 Leadership'}
                {award.tier === 'impact' && '🌟 Impact'}
                {award.tier === 'dedication' && '💪 Dedication'}
                {!award.tier && '⭐ Award'}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        marginBottom: '28px',
        padding: '24px 20px',
        background: 'linear-gradient(135deg, #ffd70022, #ff6b3511)',
        borderRadius: '20px',
        border: '1px solid #ffd70033'
      }}>
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: 700,
          color: 'var(--bs-heading-color, #212529)',
          marginBottom: '4px'
        }}>
          🏆 My Achievements
        </h2>
        <p style={{
          color: 'var(--bs-secondary-color, #6c757d)',
          fontSize: '0.95rem',
          marginBottom: 0
        }}>
          Track your certifications and awards earned through your volunteering journey.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--bs-card-bg, white)',
        padding: '4px',
        borderRadius: '14px',
        marginBottom: '24px',
        border: '1px solid var(--bs-border-color, #dee2e6)',
        position: 'relative'
      }}>
        <button
          onClick={() => setActiveTab('certifications')}
          style={{
            flex: 1,
            padding: '12px 20px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            background: activeTab === 'certifications' 
              ? 'linear-gradient(135deg, #ffd700, #f0a500)' 
              : 'transparent',
            color: activeTab === 'certifications' 
              ? 'var(--bs-body-bg, #0d1117)' 
              : 'var(--bs-secondary-color, #6c757d)',
            boxShadow: activeTab === 'certifications' 
              ? '0 4px 20px rgba(255,215,0,0.3)' 
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>📜</span> Certifications
          <span style={{
            fontSize: '0.7rem',
            background: activeTab === 'certifications' 
              ? 'rgba(0,0,0,0.1)' 
              : 'var(--bs-gray-200, #e9ecef)',
            padding: '2px 10px',
            borderRadius: '20px',
            color: activeTab === 'certifications' 
              ? 'var(--bs-body-bg, #0d1117)' 
              : 'var(--bs-secondary-color, #6c757d)'
          }}>
            {certifications.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('awards')}
          style={{
            flex: 1,
            padding: '12px 20px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            background: activeTab === 'awards' 
              ? 'linear-gradient(135deg, #ffd700, #f0a500)' 
              : 'transparent',
            color: activeTab === 'awards' 
              ? 'var(--bs-body-bg, #0d1117)' 
              : 'var(--bs-secondary-color, #6c757d)',
            boxShadow: activeTab === 'awards' 
              ? '0 4px 20px rgba(255,215,0,0.3)' 
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>🏆</span> Awards
          <span style={{
            fontSize: '0.7rem',
            background: activeTab === 'awards' 
              ? 'rgba(0,0,0,0.1)' 
              : 'var(--bs-gray-200, #e9ecef)',
            padding: '2px 10px',
            borderRadius: '20px',
            color: activeTab === 'awards' 
              ? 'var(--bs-body-bg, #0d1117)' 
              : 'var(--bs-secondary-color, #6c757d)'
          }}>
            {awards.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'certifications' && renderCertifications()}
          {activeTab === 'awards' && renderAwards()}
        </>
      )}
    </div>
  );
}