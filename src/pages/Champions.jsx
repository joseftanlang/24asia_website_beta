import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Champions() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('certifications');
  const [certifications, setCertifications] = useState([]);
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const certs = userData.certificates || [];
        setCertifications(certs);
        await calculateAwards(userData);
        setLoading(false);
      }
    });

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
    return () => unsubscribe();
  }, [user]);

  const calculateAwards = async (userData) => {
    const awardsList = [];
    const totalHours = (userData.totalHoursVolunteer || 0) + (userData.totalHoursStudent || 0);
    const certs = userData.certificates || [];
    const eventsAttended = certs.length;

    const regsSnap = await getDocs(
      query(collection(db, 'registrations'), where('userId', '==', user.uid))
    );
    const registrations = regsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const approvedRegs = registrations.filter(r => r.status === 'approved' || r.status === 'completed');
    const eventsCount = approvedRegs.length;

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
          padding: '40px 20px',
          background: 'var(--bs-card-bg, white)',
          borderRadius: '16px',
          border: '2px dashed var(--bs-border-color, #dee2e6)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📜</div>
          <h5 style={{ color: 'var(--bs-heading-color, #212529)', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>No Certifications Yet</h5>
          <p style={{ color: 'var(--bs-secondary-color, #6c757d)', fontSize: 'clamp(0.8rem, 2vw, 0.95rem)' }}>
            Complete trainings and events to earn certifications!
          </p>
        </div>
      );
    }

    return (
      <div className="row g-3">
        {certifications.map((cert, index) => (
          <div key={index} className="col-6 col-md-4 col-lg-3">
            <div style={{
              background: 'var(--bs-card-bg, white)',
              borderRadius: '12px',
              padding: '16px',
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
                height: '80px',
                background: 'linear-gradient(135deg, #ffd70022, #ff6b3522)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                fontSize: '36px'
              }}>
                📄
              </div>
              <h6 style={{ 
                fontWeight: 600, 
                color: 'var(--bs-heading-color, #212529)',
                marginBottom: '2px',
                fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)'
              }}>
                Certificate {index + 1}
              </h6>
              <p style={{ 
                fontSize: 'clamp(0.65rem, 1.2vw, 0.75rem)', 
                color: 'var(--bs-secondary-color, #6c757d)',
                flex: 1,
                marginBottom: '10px'
              }}>
                🗓 Issued on {new Date().toLocaleDateString()}
              </p>
              <a 
                href={cert} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                  color: '#0d1117',
                  border: 'none',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
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
          padding: '40px 20px',
          background: 'var(--bs-card-bg, white)',
          borderRadius: '16px',
          border: '2px dashed var(--bs-border-color, #dee2e6)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏆</div>
          <h5 style={{ color: 'var(--bs-heading-color, #212529)', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>No Awards Yet</h5>
          <p style={{ color: 'var(--bs-secondary-color, #6c757d)', fontSize: 'clamp(0.8rem, 2vw, 0.95rem)' }}>
            Keep volunteering and making an impact to earn awards!
          </p>
          <p style={{ color: 'var(--bs-secondary-color, #6c757d)', fontSize: 'clamp(0.7rem, 1.5vw, 0.85rem)', marginTop: '4px' }}>
            💡 Complete events and reach milestones to unlock awards.
          </p>
        </div>
      );
    }

    const tierOrder = { gold: 0, silver: 1, bronze: 2, leadership: 3, impact: 4, dedication: 5 };
    const sortedAwards = [...awards].sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99));

    return (
      <div className="row g-3">
        {sortedAwards.map((award) => (
          <div key={award.id} className="col-12 col-sm-6 col-md-4">
            <div style={{
              background: award.tier === 'gold' 
                ? 'linear-gradient(135deg, #ffd70022, #ffd70011)' 
                : award.tier === 'silver'
                  ? 'linear-gradient(135deg, #c0c0c022, #c0c0c011)'
                  : 'linear-gradient(135deg, #cd7f3222, #cd7f3211)',
              borderRadius: '14px',
              padding: '16px',
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
                fontSize: '60px',
                opacity: 0.08
              }}>
                {award.icon || '🏆'}
              </div>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>
                {award.icon || '🏆'}
              </div>
              <h6 style={{ 
                fontWeight: 700, 
                color: 'var(--bs-heading-color, #212529)',
                marginBottom: '2px',
                fontSize: 'clamp(0.85rem, 1.5vw, 1rem)'
              }}>
                {award.title}
              </h6>
              <p style={{ 
                fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)', 
                color: 'var(--bs-secondary-color, #6c757d)',
                marginBottom: '2px'
              }}>
                {award.issuer || '24Asia'}
              </p>
              <p style={{ 
                fontSize: 'clamp(0.65rem, 1vw, 0.7rem)', 
                color: 'var(--bs-secondary-color, #6c757d)',
                marginBottom: '8px'
              }}>
                🗓 {award.date || 'Date TBD'}
              </p>
              {award.description && (
                <p style={{
                  fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
                  color: 'var(--bs-body-color, #212529)',
                  flex: 1,
                  marginBottom: '8px'
                }}>
                  {award.description}
                </p>
              )}
              <div style={{
                padding: '3px 10px',
                background: award.tier === 'gold' 
                  ? '#ffd70033' 
                  : award.tier === 'silver'
                    ? '#c0c0c033'
                    : '#cd7f3233',
                borderRadius: '20px',
                fontSize: 'clamp(0.6rem, 1vw, 0.7rem)',
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 8px' }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        padding: '20px 16px',
        background: 'linear-gradient(135deg, #ffd70022, #ff6b3511)',
        borderRadius: '16px',
        border: '1px solid #ffd70033'
      }}>
        <h2 style={{
          fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
          fontWeight: 700,
          color: 'var(--bs-heading-color, #212529)',
          marginBottom: '2px'
        }}>
          🏆 My Achievements
        </h2>
        <p style={{
          color: 'var(--bs-secondary-color, #6c757d)',
          fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
          marginBottom: 0
        }}>
          Track your certifications and awards earned through your volunteering journey.
        </p>
      </div>

      {/* Tabs - Mobile Friendly */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--bs-card-bg, white)',
        padding: '4px',
        borderRadius: '14px',
        marginBottom: '20px',
        border: '1px solid var(--bs-border-color, #dee2e6)'
      }}>
        <button
          onClick={() => setActiveTab('certifications')}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
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
            gap: '6px'
          }}
        >
          <span>📜</span> 
          <span style={{ display: 'inline' }}>Certifications</span>
          <span style={{
            fontSize: '0.65rem',
            background: activeTab === 'certifications' 
              ? 'rgba(0,0,0,0.1)' 
              : 'var(--bs-gray-200, #e9ecef)',
            padding: '1px 8px',
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
            padding: '10px 12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
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
            gap: '6px'
          }}
        >
          <span>🏆</span> 
          <span style={{ display: 'inline' }}>Awards</span>
          <span style={{
            fontSize: '0.65rem',
            background: activeTab === 'awards' 
              ? 'rgba(0,0,0,0.1)' 
              : 'var(--bs-gray-200, #e9ecef)',
            padding: '1px 8px',
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