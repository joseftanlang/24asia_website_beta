import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import app, { db } from '../firebase';

// Ask permission, get FCM token, store it on the user doc.
// iOS note: works only on iOS 16.4+ AND only after the PWA is added to Home Screen.
export async function enablePush(uid) {
  if (!(await isSupported())) return { ok: false, reason: 'Push not supported on this browser.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'Permission denied.' };

  const reg = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FB_VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) return { ok: false, reason: 'No token issued.' };

  await updateDoc(doc(db, 'users', uid), { pushToken: token });
  onMessage(messaging, ({ notification }) => {
    if (notification) alert(`${notification.title}\n${notification.body || ''}`);
  });
  return { ok: true };
}
