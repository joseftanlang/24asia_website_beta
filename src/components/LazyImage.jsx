import { useEffect, useRef, useState } from 'react';

// Genuinely lazy image: the <img> only mounts once the wrapper scrolls within
// 200px of the viewport. The wrapper itself is a styled placeholder until then.
export default function LazyImage({ src, alt = '', className = '' }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { setInView(true); obs.disconnect(); }
      }),
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`lazy-image ${className}`}>
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={loaded ? 'is-loaded' : ''}
        />
      )}
    </div>
  );
}
