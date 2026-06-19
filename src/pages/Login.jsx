import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const { user, loginGoogle, loginFacebook } = useAuth();
  const nav = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isHovered, setIsHovered] = useState(null);

  useEffect(() => { if (user) nav('/', { replace: true }); }, [user, nav]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const go = async (fn) => {
    try { await fn(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') alert(e.message); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 50%, #0d1117 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Background Orbs */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255,215,0,0.06), transparent 70%)',
        borderRadius: '50%',
        top: '-200px',
        right: '-150px',
        animation: 'orbFloat 8s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255,100,50,0.05), transparent 70%)',
        borderRadius: '50%',
        bottom: '-150px',
        left: '-100px',
        animation: 'orbFloat 6s ease-in-out infinite reverse'
      }} />
      
      {/* Floating Particles */}
      {[...Array(15)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${Math.random() * 4 + 2}px`,
          height: `${Math.random() * 4 + 2}px`,
          background: `rgba(255,215,0, ${Math.random() * 0.3 + 0.05})`,
          borderRadius: '50%',
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animation: `particleFloat ${Math.random() * 8 + 4}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 5}s`
        }} />
      ))}

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '48px 40px',
        maxWidth: '420px',
        width: '100%',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 1,
        animation: 'fadeInUp 0.8s ease'
      }}>
        {/* Logo with pulse */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-block',
            padding: '16px 24px',
            background: 'rgba(255,215,0,0.08)',
            borderRadius: '16px',
            border: '1px solid rgba(255,215,0,0.15)',
            animation: 'logoPulse 3s ease-in-out infinite'
          }}>
            <img src="/24asia_logo.png" alt="24asia" height="44" />
          </div>
        </div>

        {/* Title with gradient animation */}
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: 700,
          textAlign: 'center',
          color: 'white',
          marginBottom: '6px'
        }}>
          Show up.{' '}
          <span style={{
            background: 'linear-gradient(120deg, #ffd700, #ff6b35, #ffd700)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 3s ease-in-out infinite'
          }}>
            Make it count.
          </span>
        </h2>
        <p style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '32px',
          fontSize: '0.9rem'
        }}>
          Track your volunteer hours, training, and impact across Asia.
        </p>

        {/* Social Buttons with cool hover */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => go(loginGoogle)}
            onMouseEnter={() => setIsHovered('google')}
            onMouseLeave={() => setIsHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '14px',
              background: isHovered === 'google' ? 'white' : 'rgba(255,255,255,0.9)',
              color: '#333',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              width: '100%',
              transform: isHovered === 'google' ? 'scale(1.03) translateY(-2px)' : 'scale(1)',
              boxShadow: isHovered === 'google' ? '0 12px 30px rgba(255,255,255,0.15)' : '0 4px 15px rgba(0,0,0,0.2)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => go(loginFacebook)}
            onMouseEnter={() => setIsHovered('facebook')}
            onMouseLeave={() => setIsHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '14px',
              background: isHovered === 'facebook' ? '#1b86ff' : '#1877f2',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              width: '100%',
              transform: isHovered === 'facebook' ? 'scale(1.03) translateY(-2px)' : 'scale(1)',
              boxShadow: isHovered === 'facebook' ? '0 12px 30px rgba(24,119,242,0.4)' : '0 4px 15px rgba(24,119,242,0.3)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Continue with Facebook
          </button>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>or continue with email</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Toggle Login/Signup with better animation */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '20px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: 4,
            left: isLogin ? 4 : '50%',
            width: 'calc(50% - 4px)',
            height: 'calc(100% - 8px)',
            background: 'linear-gradient(135deg, #ffd700, #f0a500)',
            borderRadius: '10px',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 4px 20px rgba(255,215,0,0.3)'
          }} />
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              background: 'transparent',
              color: isLogin ? '#0d1117' : 'rgba(255,255,255,0.5)',
              position: 'relative',
              zIndex: 1
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              background: 'transparent',
              color: !isLogin ? '#0d1117' : 'rgba(255,255,255,0.5)',
              position: 'relative',
              zIndex: 1
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(255,50,50,0.1)',
            border: '1px solid rgba(255,50,50,0.2)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            color: '#ff6b6b',
            fontSize: '0.85rem',
            animation: 'shake 0.5s ease'
          }}>
            {error}
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={isLogin ? handleEmailLogin : handleEmailSignup}>
          {!isLogin && (
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255,215,0,0.05)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '0.95rem',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,215,0,0.05)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  paddingRight: '48px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255,215,0,0.05)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '4px',
                  transition: 'color 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #ffd700, #f0a500)',
              color: '#0d1117',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              opacity: loading ? 0.6 : 1,
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,215,0,0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.2)',
          fontSize: '0.75rem',
          marginTop: '20px',
          transition: 'color 0.3s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
        >
          By continuing you agree to be a kind human. 🤝
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-40px) scale(1.5); opacity: 0.6; }
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 200% center; }
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.9; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}