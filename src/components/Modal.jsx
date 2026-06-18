import { useEffect } from 'react';

export default function Modal({ show, onClose, title, children, size = 'md' }) {
  // ESC key closes; body scroll locks while open.
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  if (!show) return null;

  const maxWidth = { sm: 420, md: 600, lg: 820 }[size] || 600;

  return (
    <div className="modal-backdrop-24" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-24"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {title && <h4 className="mb-3 pe-4">{title}</h4>}
        {children}
      </div>
    </div>
  );
}
