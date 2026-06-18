import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { QRCodeSVG } from 'qrcode.react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

// Country codes for phone input
const countryCodes = [
  { code: '+65', country: 'Singapore' },
  { code: '+60', country: 'Malaysia' },
  { code: '+62', country: 'Indonesia' },
  { code: '+66', country: 'Thailand' },
  { code: '+63', country: 'Philippines' },
  { code: '+84', country: 'Vietnam' },
  { code: '+1', country: 'USA/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+64', country: 'New Zealand' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'South Korea' },
  { code: '+86', country: 'China' },
  { code: '+91', country: 'India' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+852', country: 'Hong Kong' },
  { code: '+853', country: 'Macau' },
  { code: '+886', country: 'Taiwan' },
];

// Blood types
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Races with Others option
const races = ['Chinese', 'Malay', 'Indian', 'Eurasian', 'Caucasian', 'Others'];

// Religions with Others option
const religions = ['Buddhism', 'Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Taoism', 'Others', 'No Religion'];

const compressImage = async (file, maxSize = 512, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => { blob ? resolve(blob) : reject(new Error('Failed')); }, 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const enablePush = async (userId) => {
  try {
    if (!('Notification' in window)) return { ok: false, reason: 'Not supported' };
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('✅ Notifications enabled!', { body: 'You will now receive updates.', icon: '/logo.png' });
      return { ok: true, reason: 'Success' };
    }
    return { ok: false, reason: 'Permission denied' };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
};

const useInstallPrompt = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

    const handleBeforeInstallPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e); setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => { setInstalled(true); setCanInstall(false); });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      try {
        const result = await deferredPrompt.prompt();
        const outcome = result.outcome;
        setDeferredPrompt(null);
        setCanInstall(false);
        if (outcome === 'accepted') setInstalled(true);
        return outcome;
      } catch { return 'no-prompt'; }
    }
    return 'no-prompt';
  };

  return { canInstall, installed, isIOS, promptInstall };
};

export default function Settings() {
  const { user, profile, setProfileLocal } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const { canInstall, installed, isIOS, promptInstall } = useInstallPrompt();

  // Delete account states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Collapse state for mobile
  const [isCollapsed, setIsCollapsed] = useState(true);

  const getRoles = () => {
    const roles = profile?.roles;
    if (!roles) return [];
    if (Array.isArray(roles)) return roles;
    if (typeof roles === 'string') return [roles];
    return [];
  };

  const getRoleBadge = () => {
    const roles = getRoles();
    if (roles.includes('Manager')) return { label: 'Manager', color: 'bg-white text-dark', icon: '👔' };
    if (roles.includes('Volunteer Leader')) return { label: 'Volunteer Leader', color: 'bg-danger', icon: '⭐' };
    if (roles.includes('Volunteer')) return { label: 'Volunteer', color: 'bg-warning text-dark', icon: '🤝' };
    if (roles.includes('Student')) return { label: 'Student', color: 'bg-warning text-dark', icon: '🎓' };
    return { label: 'Student', color: 'bg-warning text-dark', icon: '🎓' };
  };

  const getRoleColor = () => {
    const roles = getRoles();
    if (roles.includes('Manager')) return '#ffffff';
    if (roles.includes('Volunteer Leader')) return '#dc3545';
    if (roles.includes('Volunteer')) return '#ff8c00';
    if (roles.includes('Student')) return '#ffc107';
    return '#ffc107';
  };

  // Generate Volunteer ID
  // Generate Volunteer ID based on registration date
  const generateVolunteerId = () => {
    let registrationDate;
    if (profile?.createdAt?.toDate) {
      registrationDate = profile.createdAt.toDate();
    } else if (profile?.createdAt) {
      registrationDate = new Date(profile.createdAt);
    } else {
      registrationDate = new Date();
    }

    const year = registrationDate.getFullYear();
    const month = String(registrationDate.getMonth() + 1).padStart(2, '0');
    const day = String(registrationDate.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // use a random 4-digit number
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);
    return `${dateStr}${randomNum}`;
  };

  const volunteerId = generateVolunteerId();

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setMsg('Installing…');
    else setMsg('Use your browser menu → "Install app" or "Add to Home Screen".');
  };

  useEffect(() => {
    if (profile && !form) {
      let roles = profile.roles;
      if (typeof roles === 'string') roles = [roles];
      if (!roles) roles = [];

      let phoneCode = '+65';
      let phoneNumber = profile.phone || '';
      if (profile.phone) {
        const matched = countryCodes.find(c => profile.phone.startsWith(c.code));
        if (matched) {
          phoneCode = matched.code;
          phoneNumber = profile.phone.replace(matched.code, '');
        }
      }

      let race = profile.race || '';
      let customRace = '';
      if (race && !races.includes(race)) {
        customRace = race;
        race = 'Others';
      }

      let religion = profile.religion || '';
      let customReligion = '';
      if (religion && !religions.includes(religion)) {
        customReligion = religion;
        religion = 'Others';
      }

      setForm({
        name: profile.name || '',
        phoneCode: phoneCode,
        phoneNumber: phoneNumber,
        dob: profile.dob || '',
        gender: profile.gender || 'prefer_not_to_say',
        address: profile.address || '',
        race: race,
        customRace: customRace,
        religion: religion,
        customReligion: customReligion,
        citizenship: profile.citizenship || '',
        bloodType: profile.bloodType || '',
        emergencyName: profile.emergencyName || '',
        emergencyContact: profile.emergencyContact || '',
        profileText: profile.profileText || '',
        interests: (profile.interests || []).join(', '),
        roles: roles,
      });
    }
  }, [profile, form]);

  if (!profile || !form) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleRole = (role) => setForm((f) => ({
    ...f,
    roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
  }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const selfRoles = form.roles.filter((r) => ['Volunteer', 'Student', 'Volunteer Leader'].includes(r));
      const roles = profile.roles?.includes('Manager') ? [...new Set([...selfRoles, 'Manager'])] : selfRoles;

      const fullPhone = form.phoneCode + form.phoneNumber.replace(/\s/g, '');

      const finalRace = form.race === 'Others' && form.customRace ? form.customRace : form.race;
      const finalReligion = form.religion === 'Others' && form.customReligion ? form.customReligion : form.religion;

      const updates = {
        name: form.name.trim(),
        phone: fullPhone,
        dob: form.dob,
        gender: form.gender,
        address: form.address.trim(),
        race: finalRace,
        religion: finalReligion,
        citizenship: form.citizenship.trim(),
        bloodType: form.bloodType,
        emergencyName: form.emergencyName.trim(),
        emergencyContact: form.emergencyContact.trim(),
        profileText: form.profileText.trim(),
        interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
        roles,
        volunteerId: volunteerId, // Save volunteer ID to profile
      };
      const writeData = { ...updates, lastUpdatedAt: serverTimestamp() };
      if (profile?.onboardingComplete !== true) writeData.onboardingComplete = true;
      await updateDoc(doc(db, 'users', user.uid), writeData);
      setProfileLocal({ ...updates, onboardingComplete: true });
      setMsg('Profile saved successfully!');
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const small = await compressImage(file, 512, 0.85);
      const r = ref(storage, `profilePhotos/${user.uid}/photo_${Date.now()}`);
      await uploadBytes(r, small, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, 'users', user.uid), { photoUrl: url, lastUpdatedAt: serverTimestamp() });
      setProfileLocal({ photoUrl: url });
      setMsg('Photo updated!');
    } catch (err) { setMsg(err.message); } finally { setSaving(false); }
  };

  const toggleTheme = () => {
    const next = profile.theme === 'dark' ? 'light' : 'dark';
    setProfileLocal({ theme: next });
    updateDoc(doc(db, 'users', user.uid), { theme: next });
    setMsg(`Theme changed to ${next}`);
  };

  const onEnablePush = async () => {
    const res = await enablePush(user.uid);
    setMsg(res.ok ? 'Notifications enabled!' : `Error: ${res.reason}`);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setDeleteStep(1);
  };

  const handleDeleteConfirm = async () => {
    if (deleteStep < 3) {
      setDeleteStep(deleteStep + 1);
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await user.delete();
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Delete account error:', error);
      setMsg('Error deleting account: ' + error.message);
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteStep(1);
  };

  const roleBadge = getRoleBadge();
  const roleColor = getRoleColor();

  return (
    <div className="settings-container">
      <h3 className="mb-4">Settings</h3>
      {msg && <div className={`alert ${msg.includes('success') || msg.includes('enabled') || msg.includes('updated') ? 'alert-success' : 'alert-info'} py-2`}>{msg}</div>}

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card p-4">
            {/* Collapsible Header for Mobile */}
            <div
              className="d-flex d-lg-none justify-content-between align-items-center cursor-pointer"
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{ cursor: 'pointer' }}
            >
              <h5 className="mb-0">Profile Information</h5>
              <span style={{ fontSize: '1.5rem' }}>
                {isCollapsed ? '▼' : '▲'}
              </span>
            </div>

            {/* Always visible on desktop, collapsible on mobile */}
            <div style={{
              display: window.innerWidth >= 992 ? 'block' : (isCollapsed ? 'none' : 'block')
            }}>
              <h5 className="mb-3 d-none d-lg-block">Profile Information</h5>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Profile Photo</label>
                  <div className="d-flex align-items-center gap-3">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt="Profile" className="profile-photo-preview" />
                    ) : (
                      <div className="profile-photo-placeholder">{(profile.name || '?').charAt(0).toUpperCase()}</div>
                    )}
                    <label className="btn btn-outline-secondary">
                      Change Photo
                      <input type="file" accept="image/*" hidden onChange={uploadPhoto} />
                    </label>
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" value={form.name} onChange={set('name')} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Phone Number</label>
                  <div className="d-flex gap-2">
                    <select
                      className="form-select"
                      value={form.phoneCode}
                      onChange={set('phoneCode')}
                      style={{ width: '120px', flexShrink: 0 }}
                    >
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      className="form-control"
                      value={form.phoneNumber}
                      onChange={set('phoneNumber')}
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className="form-control" value={form.dob} onChange={set('dob')} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender} onChange={set('gender')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                <div className="col-md-12">
                  <label className="form-label">Address</label>
                  <input className="form-control" value={form.address} onChange={set('address')} placeholder="Enter your address" />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Race</label>
                  <select className="form-select" value={form.race} onChange={set('race')}>
                    <option value="">Select race</option>
                    {races.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {form.race === 'Others' && (
                    <input
                      className="form-control mt-2"
                      value={form.customRace}
                      onChange={set('customRace')}
                      placeholder="Please specify your race"
                    />
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label">Religion</label>
                  <select className="form-select" value={form.religion} onChange={set('religion')}>
                    <option value="">Select religion</option>
                    {religions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {form.religion === 'Others' && (
                    <input
                      className="form-control mt-2"
                      value={form.customReligion}
                      onChange={set('customReligion')}
                      placeholder="Please specify your religion"
                    />
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label">Citizenship</label>
                  <input className="form-control" value={form.citizenship} onChange={set('citizenship')} placeholder="e.g. Singaporean" />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Blood Type</label>
                  <select className="form-select" value={form.bloodType} onChange={set('bloodType')}>
                    <option value="">Select blood type</option>
                    {bloodTypes.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Emergency Contact Name</label>
                  <input className="form-control" value={form.emergencyName} onChange={set('emergencyName')} placeholder="Emergency contact person" />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Emergency Contact Number</label>
                  <input className="form-control" value={form.emergencyContact} onChange={set('emergencyContact')} placeholder="Emergency contact number" />
                </div>

                <div className="col-12">
                  <label className="form-label">About Me</label>
                  <textarea className="form-control" rows="3" value={form.profileText} onChange={set('profileText')} />
                </div>

                <div className="col-12">
                  <label className="form-label">Interests (comma separated)</label>
                  <input className="form-control" value={form.interests} onChange={set('interests')} placeholder="e.g. Teaching, Environment, Youth" />
                </div>

                <div className="col-12">
                  <label className="form-label d-block">I am a…</label>
                  <div className="d-flex flex-wrap gap-2">
                    {['Volunteer', 'Volunteer Leader', 'Student'].map((r) => (
                      <div className="form-check form-check-inline" key={r}>
                        <input className="form-check-input" type="checkbox" id={r}
                          checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                        <label className="form-check-label" htmlFor={r}>{r}</label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <span className="text-secondary small">Current title: </span>
                    <span className={`badge ${roleBadge.color} fs-6 px-3 py-2`}>{roleBadge.label}</span>
                  </div>
                  {profile.roles?.includes('Manager') && (
                    <div className="mt-2">
                      <span className="badge bg-danger">Manager</span>
                      <span className="text-secondary small ms-2">(Manager title is assigned by admin)</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="d-flex gap-2 mt-4">
                <button className="btn btn-brand" disabled={saving} onClick={save}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={handleDeleteClick}
                  style={{ borderColor: '#dc3545', color: '#dc3545' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dc3545';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#dc3545';
                  }}
                >
                  🗑️ Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div
            className="card qr-card p-4 text-center mb-4"
            style={{
              borderColor: roleColor,
              borderWidth: '3px',
              borderStyle: 'solid',
              backgroundColor: roleColor + '15'
            }}
          >
            <h5 style={{ color: roleColor }}>My check-in QR</h5>
            <div className="my-2">
              {profile.photoUrl ? (
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: 100,
                    height: 100,
                    backgroundColor: roleColor,
                    padding: '3px'
                  }}
                >
                  <img
                    src={profile.photoUrl}
                    alt=""
                    width="94"
                    height="94"
                    className="rounded-circle object-fit-cover"
                  />
                </div>
              ) : (
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center text-white"
                  style={{
                    width: 96,
                    height: 96,
                    fontSize: 36,
                    backgroundColor: roleColor
                  }}
                >
                  {(profile.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="fw-semibold mb-1">{profile.name}</div>

            <div className="text-secondary small mb-2">Title: {profile.roles?.join(' , ')}</div>
            <div className="text-muted small mb-2" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>
              ID: {volunteerId}
            </div>
            <p className="small text-secondary">Show this to the event volunteer to record your attendance.</p>
            <div className="qr-frame mx-auto"><QRCodeSVG value={user.uid} size={180} /></div>
            <code className="small mt-2">{user.uid}</code>
          </div>

          <div className="card p-4 mb-4">
            <h5 className="mb-3">App Settings</h5>
            <div className="settings-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">Theme</div>
                  <div className="text-secondary small">Switch between light and dark mode</div>
                </div>
                <button className="btn btn-outline-secondary btn-sm" onClick={toggleTheme}>
                  {profile.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
            </div>
            <hr />
            <div className="settings-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">Notifications</div>
                  <div className="text-secondary small">Enable push notifications</div>
                </div>
                <button className="btn btn-outline-primary btn-sm" onClick={onEnablePush}>🔔 Enable</button>
              </div>
            </div>
            <hr />
            <div className="settings-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">Install App</div>
                  <div className="text-secondary small">Install 24asia as a standalone app</div>
                </div>
                {!installed ? (
                  <button className="btn btn-success btn-sm" onClick={onInstall}>📱 Install</button>
                ) : (
                  <span className="badge bg-success">✅ Installed</span>
                )}
              </div>
            </div>
            {!installed && isIOS && (
              <div className="alert alert-info mt-3 small">
                <strong>On iPhone/iPad:</strong> tap <strong>Share</strong> → <strong>"Add to Home Screen"</strong>
              </div>
            )}
            {!installed && !isIOS && !canInstall && (
              <div className="alert alert-secondary mt-3 small">
                Use your browser's menu → "Install app" or "Add to Home Screen"
              </div>
            )}
          </div>

          <div className="card p-4">
            <h5 className="mb-3">Account</h5>
            <div className="settings-item">
              <div className="text-secondary small">Email</div>
              <div className="fw-semibold">{profile.email}</div>
            </div>
            <div className="settings-item mt-2">
              <div className="text-secondary small">Volunteer ID</div>
              <div className="fw-semibold" style={{ fontFamily: 'monospace' }}>{volunteerId}</div>
            </div>
            <div className="settings-item mt-2">
              <div className="text-secondary small">User ID</div>
              <div className="fw-semibold text-truncate" style={{ fontSize: '0.85rem' }}>{user.uid}</div>
            </div>
            <div className="settings-item mt-2">
              <div className="text-secondary small">Account Status</div>
              <span className={`badge ${profile.status === 'approved' ? 'bg-success' : 'bg-warning'}`}>
                {profile.status || 'pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={handleDeleteCancel}>
          <div style={{
            backgroundColor: 'var(--bs-card-bg, white)',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              {deleteStep === 1 && <div style={{ fontSize: '48px' }}>⚠️</div>}
              {deleteStep === 2 && <div style={{ fontSize: '48px' }}>😰</div>}
              {deleteStep === 3 && <div style={{ fontSize: '48px' }}>💔</div>}
            </div>

            <h4 style={{
              textAlign: 'center',
              marginBottom: '12px',
              color: 'var(--bs-heading-color, #212529)'
            }}>
              {deleteStep === 1 && 'Delete Account?'}
              {deleteStep === 2 && 'Are you absolutely sure?'}
              {deleteStep === 3 && 'Final Confirmation'}
            </h4>

            <p style={{
              textAlign: 'center',
              color: 'var(--bs-secondary-color, #6c757d)',
              marginBottom: '20px',
              fontSize: '0.95rem'
            }}>
              {deleteStep === 1 && 'This action cannot be undone. All your data will be permanently removed.'}
              {deleteStep === 2 && (
                <>
                  This is your <strong>SECOND</strong> warning.
                  <br />
                  All your volunteer hours, certificates, and event history will be lost forever.
                </>
              )}
              {deleteStep === 3 && (
                <>
                  This is your <strong>FINAL</strong> warning.
                  <br />
                  <span style={{ color: '#dc3545', fontWeight: 700 }}>Click "Confirm Delete" to permanently delete your account.</span>
                </>
              )}
            </p>

            <div style={{
              padding: '12px',
              background: 'rgba(220, 53, 69, 0.08)',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.85rem', color: '#dc3545' }}>
                {deleteStep === 1 && 'Step 1 of 3 — Please confirm you want to proceed.'}
                {deleteStep === 2 && 'Step 2 of 3 — This is your second confirmation.'}
                {deleteStep === 3 && 'Step 3 of 3 — Final confirmation to delete.'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                style={{
                  padding: '10px 28px',
                  background: 'var(--bs-gray-200, #e9ecef)',
                  color: 'var(--bs-body-color, #212529)',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bs-gray-300, #dee2e6)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bs-gray-200, #e9ecef)'}
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '10px 28px',
                  background: deleteStep === 3 ? '#dc3545' : '#ffc107',
                  color: deleteStep === 3 ? 'white' : '#212529',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  boxShadow: deleteStep === 3 ? '0 4px 15px rgba(220,53,69,0.3)' : '0 4px 15px rgba(255,193,7,0.3)'
                }}
                onMouseEnter={(e) => {
                  if (deleteStep === 3) {
                    e.currentTarget.style.background = '#c82333';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(220,53,69,0.4)';
                  } else {
                    e.currentTarget.style.background = '#e0a800';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(255,193,7,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (deleteStep === 3) {
                    e.currentTarget.style.background = '#dc3545';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(220,53,69,0.3)';
                  } else {
                    e.currentTarget.style.background = '#ffc107';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(255,193,7,0.3)';
                  }
                }}
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : (
                  deleteStep === 1 ? 'Yes, Delete My Account' :
                    deleteStep === 2 ? 'Yes, I\'m Sure (2/3)' :
                      '⚠️ Confirm Delete (3/3)'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}