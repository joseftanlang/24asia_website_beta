import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { QRCodeSVG } from 'qrcode.react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { enablePush } from '../lib/notifications';
import useInstallPrompt from '../lib/useInstallPrompt';
import { compressImage } from '../lib/images';

export default function Profile() {
  const { user, profile, setProfileLocal } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const { canInstall, installed, isIOS, promptInstall } = useInstallPrompt();

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setMsg('Installing…');
    else if (outcome === 'no-prompt') setMsg('Use your browser menu → "Install app" or "Add to Home Screen".');
  };

  useEffect(() => {
    if (profile && !form) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || '',
        dob: profile.dob || '',
        gender: profile.gender || 'prefer_not_to_say',
        profileText: profile.profileText || '',
        interests: (profile.interests || []).join(', '),
        roles: profile.roles || [],
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
      // Members can self-assign Volunteer/Student only; keep Manager if already granted.
      const selfRoles = form.roles.filter((r) => ['Volunteer', 'Student'].includes(r));
      const roles = profile.roles?.includes('Manager') ? [...new Set([...selfRoles, 'Manager'])] : selfRoles;
      const updates = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        dob: form.dob,
        gender: form.gender,
        profileText: form.profileText.trim(),
        interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
        roles,
      };
      const writeData = { ...updates, lastUpdatedAt: serverTimestamp() };
      // First save flips onboardingComplete to true so future logins go to Dashboard.
      if (profile?.onboardingComplete !== true) writeData.onboardingComplete = true;
      await updateDoc(doc(db, 'users', user.uid), writeData);
      setProfileLocal({ ...updates, onboardingComplete: true });
      setMsg('Profile saved.');
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
    } catch (err) { setMsg(err.message); } finally { setSaving(false); }
  };

  const toggleTheme = () => {
    const next = profile.theme === 'dark' ? 'light' : 'dark';
    setProfileLocal({ theme: next });
    updateDoc(doc(db, 'users', user.uid), { theme: next });
  };

  const onEnablePush = async () => {
    const res = await enablePush(user.uid);
    setMsg(res.ok ? 'Notifications enabled.' : `Notifications: ${res.reason}`);
  };

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-7">
        <h4 className="mb-3">My profile</h4>
        {msg && <div className="alert alert-info py-2">{msg}</div>}

        <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Name</label>
            <input className="form-control" value={form.name} onChange={set('name')} /></div>
          <div className="col-md-6"><label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={set('phone')} /></div>
          <div className="col-md-6"><label className="form-label">Date of birth</label>
            <input type="date" className="form-control" value={form.dob} onChange={set('dob')} /></div>
          <div className="col-md-6"><label className="form-label">Gender</label>
            <select className="form-select" value={form.gender} onChange={set('gender')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select></div>
          <div className="col-12"><label className="form-label">About me</label>
            <textarea className="form-control" rows="3" value={form.profileText} onChange={set('profileText')} /></div>
          <div className="col-12"><label className="form-label">Interests (comma separated)</label>
            <input className="form-control" value={form.interests} onChange={set('interests')} /></div>
          <div className="col-12">
            <label className="form-label d-block">I am a…</label>
            {['Volunteer', 'Student'].map((r) => (
              <div className="form-check form-check-inline" key={r}>
                <input className="form-check-input" type="checkbox" id={r}
                  checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                <label className="form-check-label" htmlFor={r}>{r}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-brand" disabled={saving} onClick={save}>Save changes</button>
          <button className="btn btn-outline-secondary" onClick={toggleTheme}>
            {profile.theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          <button className="btn btn-outline-secondary" onClick={onEnablePush}>Enable notifications</button>
          {!installed && (
            <button className="btn btn-outline-secondary" onClick={onInstall}>
              📱 Install app
            </button>
          )}
          {installed && <span className="badge bg-success align-self-center">App installed</span>}
        </div>
        {!installed && isIOS && (
          <div className="alert alert-info mt-3 small">
            <strong>On iPhone/iPad:</strong> tap the <strong>Share</strong> button in Safari, then <strong>"Add to Home Screen"</strong>. The app then runs full-screen and can send notifications.
          </div>
        )}
      </div>

      <div className="col-12 col-lg-5">
        <div className="card qr-card p-4 text-center mb-4">
          <h5>My check-in QR</h5>
          <div className="my-2">
            {profile.photoUrl
              ? <img src={profile.photoUrl} alt="" width="96" height="96" className="rounded-circle object-fit-cover border border-2 border-danger" />
              : <span className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center text-white" style={{ width: 96, height: 96, fontSize: 36 }}>{(profile.name || '?').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="fw-semibold mb-1">{profile.name}</div>
          <label className="btn btn-sm btn-outline-secondary mx-auto mb-2" style={{ width: 'fit-content' }}>
            Change photo
            <input type="file" accept="image/*" hidden onChange={uploadPhoto} />
          </label>
          <p className="small text-secondary">Show this to the event volunteer to record your attendance.</p>
          <div className="qr-frame mx-auto"><QRCodeSVG value={user.uid} size={180} /></div>
          <code className="small mt-2">{user.uid}</code>
        </div>

        <h5>My certificates</h5>
        {(profile.certificates || []).length === 0 && (
          <p className="text-secondary small">No certificates yet.</p>
        )}
        <ul className="list-group">
          {(profile.certificates || []).map((url, i) => (
            <li className="list-group-item" key={url}>
              <a href={url} target="_blank" rel="noreferrer">Certificate {i + 1}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
