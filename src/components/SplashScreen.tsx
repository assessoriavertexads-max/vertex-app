import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'draw' | 'hold' | 'out'>('draw');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 1000);
    const t2 = setTimeout(() => setPhase('out'), 2600);
    const t3 = setTimeout(onDone, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const isOut = phase === 'out';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0E1116',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isOut ? 0 : 1,
        transition: isOut ? 'opacity 0.6s ease' : 'none',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes vertos-draw-outer {
          from { stroke-dashoffset: 270; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes vertos-draw-inner {
          from { stroke-dashoffset: 68; opacity: 0; }
          10%  { opacity: 1; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes vertos-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vertos-fade-in {
          from { opacity: 0; }
          to   { opacity: 0.4; }
        }
        @keyframes vertos-pulse-glow {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50%       { opacity: 0.22; transform: scale(1.08); }
        }
      `}</style>

      {/* Aurora glow */}
      <div
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(13,184,120,0.22) 0%, rgba(6,122,80,0.1) 45%, transparent 70%)',
          filter: 'blur(64px)',
          pointerEvents: 'none',
          animation: 'vertos-pulse-glow 3s ease-in-out infinite',
        }}
      />

      {/* V mark */}
      <div style={{ width: 120, height: 120, marginBottom: 28 }}>
        <svg viewBox="0 0 200 200" width="120" height="120" aria-hidden>
          {/* Outer V — white */}
          <path
            d="M32 42 L100 158 L168 42"
            fill="none"
            stroke="white"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 270,
              strokeDashoffset: 270,
              animation: 'vertos-draw-outer 0.85s cubic-bezier(0.4,0,0.2,1) 0.1s forwards',
            }}
          />
          {/* Inner speed mark — emerald */}
          <path
            d="M100 100 L134 42"
            fill="none"
            stroke="#0DB878"
            strokeWidth="13"
            strokeLinecap="round"
            style={{
              strokeDasharray: 68,
              strokeDashoffset: 68,
              opacity: 0,
              animation: 'vertos-draw-inner 0.45s cubic-bezier(0.4,0,0.2,1) 0.75s forwards',
            }}
          />
        </svg>
      </div>

      {/* Wordmark */}
      <div
        style={{
          fontFamily: "'Sora', system-ui, -apple-system, sans-serif",
          fontWeight: 800,
          fontSize: 44,
          letterSpacing: '-0.03em',
          color: '#ffffff',
          lineHeight: 1,
          opacity: 0,
          animation: 'vertos-fade-up 0.55s ease 0.9s forwards',
        }}
      >
        vertos
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: "'Sora', system-ui, -apple-system, sans-serif",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.4)',
          marginTop: 10,
          textTransform: 'uppercase',
          opacity: 0,
          animation: 'vertos-fade-in 0.55s ease 1.2s forwards',
        }}
      >
        Gestão de Performance
      </div>

      {/* Loading bar — emerald gradient */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          background: 'linear-gradient(90deg, #067A50, #0DB878, #21E29A)',
          width:
            phase === 'draw'
              ? '0%'
              : phase === 'hold'
              ? '88%'
              : '100%',
          transition:
            phase === 'draw'
              ? 'none'
              : phase === 'hold'
              ? 'width 1.5s cubic-bezier(0.4,0,0.2,1)'
              : 'width 0.3s ease',
        }}
      />
    </div>
  );
}
