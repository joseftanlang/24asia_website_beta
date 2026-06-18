import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loginGoogle /* , loginApple */ } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (user) nav('/', { replace: true }); }, [user, nav]);

  const go = async (fn) => {
    try { await fn(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') alert(e.message); }
  };

  return (
    <div className="auth-card">
      <span className="logo-chip mb-4" style={{ padding: '10px 18px' }}>
        <img src="/logo.png" alt="24asia" height="44" />
      </span>
      <h2 className="mb-2" style={{ fontSize: '1.75rem' }}>Show up. <span style={{ background: 'linear-gradient(120deg, var(--brand), var(--coral) 60%, var(--amber))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Make it count.</span></h2>
      <p className="text-secondary mb-4">Track your volunteer hours, training, and impact across Asia.</p>
      <button className="btn btn-brand btn-lg w-100 mb-3" onClick={() => go(loginGoogle)}>
        Continue with Google
      </button>
      <p className="small text-secondary mt-3 mb-0">By continuing you agree to be a kind human.</p>
    </div>
  );
}
