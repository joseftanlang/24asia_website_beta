import { useEffect, useState } from 'react';

// Captures the browser's install prompt (Chrome/Edge/Android), and reports
// whether the app is already installed or running on iOS (where install is manual).
export default function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setInstalled(standalone);

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const promptInstall = async () => {
    if (!deferred) return 'no-prompt';
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome; // 'accepted' | 'dismissed'
  };

  return { canInstall: !!deferred, installed, isIOS, promptInstall };
}
