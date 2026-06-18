import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from '../firebase';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(undefined); // undefined = booting
  const [profile, setProfile] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setFbUser), []);

  // One-shot fetch (no live listener). On first login, create the doc.
  useEffect(() => {
    let cancelled = false;
    if (!fbUser) { setProfile(null); return () => { cancelled = true; }; }
    const ref = doc(db, 'users', fbUser.uid);
    (async () => {
      const snap = await getDoc(ref);
      if (cancelled) return;
      if (!snap.exists()) {
        const initial = {
          name: fbUser.displayName || '',
          email: fbUser.email || '',
          phone: '',
          dob: '',
          gender: 'prefer_not_to_say',
          photoUrl: fbUser.photoURL || '',
          profileText: '',
          interests: [],
          roles: ['Volunteer'],
          status: 'pending',
          theme: 'dark',
          pushToken: '',
          createdAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp(),
          totalHoursVolunteer: 0,
          totalHoursStudent: 0,
          attendedEventIds: [],
          certificates: [],
          onboardingComplete: false,
        };
        await setDoc(ref, initial);
        if (!cancelled) setProfile({ id: fbUser.uid, ...initial });
      } else {
        setProfile({ id: snap.id, ...snap.data() });
      }
    })();
    return () => { cancelled = true; };
  }, [fbUser]);

  // Optimistic-update helper: after the caller writes to their own user doc,
  // they pass the same `updates` to this so the UI reflects them immediately
  // without a second read.
  const setProfileLocal = useCallback((updates) => {
    setProfile((p) => (p ? { ...p, ...updates } : p));
  }, []);

  // Apply saved theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', profile?.theme || 'dark');
  }, [profile?.theme]);

  const value = {
    booting: fbUser === undefined || (fbUser && !profile),
    user: fbUser || null,
    profile,
    setProfileLocal,
    isApproved: profile?.status === 'approved',
    isManager: profile?.status === 'approved' && (profile?.roles || []).includes('Manager'),
    loginGoogle: () => signInWithPopup(auth, googleProvider),
    loginApple: () => signInWithPopup(auth, appleProvider),
    logout: () => signOut(auth),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
