import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(onDone, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a0f1e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'out' ? 0 : 1,
        transition: phase === 'in' ? 'opacity 0.6s ease' : phase === 'out' ? 'opacity 0.6s ease' : 'none',
        userSelect: 'none',
      }}
    >
      {/* Glow background */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Logo mark */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 0 40px rgba(99,102,241,0.4)',
        transform: phase === 'in' ? 'scale(0.85)' : 'scale(1)',
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M8 28L18 8L28 28H22L18 19L14 28H8Z" fill="white" fillOpacity="0.95" />
        </svg>
      </div>

      {/* Name */}
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        opacity: phase === 'in' ? 0 : 1,
        transform: phase === 'in' ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
      }}>
        VERTOS
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.45)',
        marginTop: 6,
        textTransform: 'uppercase',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        opacity: phase === 'in' ? 0 : 1,
        transition: 'opacity 0.5s ease 0.4s',
      }}>
        Gestão de Performance
      </div>

      {/* Loading bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 2,
        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
        width: phase === 'in' ? '0%' : phase === 'hold' ? '85%' : '100%',
        transition: phase === 'in' ? 'none' : phase === 'hold' ? 'width 1.5s cubic-bezier(0.4,0,0.2,1)' : 'width 0.3s ease',
      }} />
    </div>
  );
}
