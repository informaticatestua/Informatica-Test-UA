import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import {
  STEPS,
  STEPS_START,
  STEP_DUR,
  INTRO_END,
  PRESS_DUR,
  COINS,
  AMOUNT,
} from './config';

// ── Paleta (tomada de subjects/ADA/styles.css) ────────────────────────
const C = {
  appBg: '#eef2f7',
  surface: '#ffffff',
  txt: '#0f172a',
  txt2: '#475569',
  muted: '#94a3b8',
  blue: '#3b82f6',
  blueDark: '#1d4ed8',
  green: '#10b981',
  border: '#e2e8f0',
  sidebar: '#0d1324',
};

const MONO = "'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace";
const SANS =
  "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif";

// ── Moneda ────────────────────────────────────────────────────────────
const Coin: React.FC<{
  value: number;
  state?: 'normal' | 'cur' | 'na';
  size?: number;
  scale?: number;
}> = ({ value, state = 'normal', size = 62, scale = 1 }) => {
  const copper = value <= 5;
  const face = copper
    ? 'radial-gradient(circle at 35% 28%, #f6bd94 0%, #d0834f 42%, #a95c2d 74%, #7c3d16 100%)'
    : 'radial-gradient(circle at 35% 28%, #fdeaa0 0%, #f4c542 40%, #d99a2b 74%, #b47818 100%)';
  const metalShadow = copper
    ? 'inset 0 2px 3px rgba(255,255,255,.5), inset 0 -3px 6px rgba(95,45,15,.6)'
    : 'inset 0 2px 3px rgba(255,255,255,.7), inset 0 -3px 6px rgba(140,95,15,.55)';

  const lift = state === 'cur' ? -4 : 0;
  const s = (state === 'cur' ? 1.12 : 1) * scale;

  let ring = '0 3px 6px rgba(0,0,0,.28)';
  if (state === 'cur')
    ring = `0 0 0 3px ${C.blue}, 0 6px 14px rgba(59,130,246,.5)`;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: MONO,
        fontWeight: 800,
        fontSize: size * 0.34,
        color: copper ? '#6b2f10' : '#7c5a10',
        background: face,
        border: `2px solid ${copper ? '#8a4a22' : '#a9781a'}`,
        boxShadow: `${metalShadow}, ${ring}`,
        textShadow: '0 1px 0 rgba(255,255,255,.4)',
        transform: `translateY(${lift}px) scale(${s})`,
        filter: state === 'na' ? 'grayscale(.65) brightness(.92)' : 'none',
        opacity: state === 'na' ? 0.5 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 5,
          borderRadius: '50%',
          border: `1.5px dashed ${copper ? 'rgba(95,45,15,.4)' : 'rgba(140,95,15,.4)'}`,
        }}
      />
      {value}
    </div>
  );
};

// ── Cursor (puntero de ratón dibujado) ────────────────────────────────
const Cursor: React.FC<{ x: number; y: number; press: number }> = ({
  x,
  y,
  press,
}) => (
  <svg
    width={40}
    height={40}
    viewBox="0 0 24 24"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `scale(${1 - press * 0.18})`,
      transformOrigin: 'top left',
      filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.35))',
      zIndex: 40,
    }}
  >
    <path
      d="M5 3l14 8-6 1.5L10 20 5 3z"
      fill="#0f172a"
      stroke="#ffffff"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </svg>
);

// ── Botón de reproducción del overlay ─────────────────────────────────
const PlayControl: React.FC<{ scale: number; glow: number }> = ({
  scale,
  glow,
}) => (
  <div
    style={{
      width: 108,
      height: 108,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `scale(${scale})`,
      boxShadow: `0 12px 30px rgba(29,78,216,${0.35 + glow * 0.25}), 0 0 0 ${
        6 + glow * 10
      }px rgba(59,130,246,${0.18 * (1 - glow)})`,
    }}
  >
    <div
      style={{
        width: 0,
        height: 0,
        borderTop: '22px solid transparent',
        borderBottom: '22px solid transparent',
        borderLeft: '36px solid white',
        marginLeft: 10,
      }}
    />
  </div>
);

// ── Composición principal ─────────────────────────────────────────────
export const CoinChange: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Paso actual del algoritmo
  const started = frame >= STEPS_START;
  const rawIdx = Math.floor((frame - STEPS_START) / STEP_DUR);
  const idx = started ? Math.min(Math.max(rawIdx, 0), STEPS.length - 1) : 0;
  const step = STEPS[idx];
  const localFrame = started ? (frame - STEPS_START) % STEP_DUR : 0;

  // Overlay de intro / animación de "play"
  const pressProgress = interpolate(
    frame,
    [INTRO_END, INTRO_END + PRESS_DUR],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const overlayOpacity = 1 - pressProgress;
  const playScale = 1 - Math.sin(pressProgress * Math.PI) * 0.16;
  const glowPulse =
    (Math.sin((frame / fps) * Math.PI * 2 * 0.9) + 1) / 2; // 0..1

  // Puntero: entra desde abajo-derecha hacia el botón, luego "click"
  const cx = width / 2 + 6;
  const cy = height * 0.52 + 6;
  const curX = interpolate(frame, [6, INTRO_END], [width * 0.74, cx], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const curY = interpolate(frame, [6, INTRO_END], [height * 0.9, cy], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Rebote de la moneda "en foco"
  const bounce =
    step.cur >= 0
      ? 1 + Math.sin(Math.min(localFrame / 6, 1) * Math.PI) * 0.06
      : 1;

  // Pop de la última moneda recién cogida
  const popScale = step.justTook
    ? spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 180 } })
    : 1;

  // Lower-third de marca, aparece tras el play
  const brandIn = interpolate(
    frame,
    [STEPS_START, STEPS_START + 14],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const remaining = step.remaining;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 700px at 50% -10%, #ffffff 0%, ${C.appBg} 60%)`,
        fontFamily: SANS,
      }}
    >
      {/* Ventana de la app */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          width: width - 120,
          height: height - 120,
          background: C.surface,
          borderRadius: 22,
          border: `1px solid ${C.border}`,
          boxShadow:
            '0 40px 80px rgba(15,23,42,.16), 0 8px 20px rgba(15,23,42,.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Barra de título */}
        <div
          style={{
            height: 52,
            background: C.sidebar,
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#ff5f57' }} />
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#febc2e' }} />
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#28c840' }} />
          <span
            style={{
              marginLeft: 16,
              color: '#cbd5e1',
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: 0.2,
            }}
          >
            AlgoVisual · ADA
          </span>
          <span
            style={{
              marginLeft: 'auto',
              color: '#64748b',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Análisis y Diseño de Algoritmos
          </span>
        </div>

        {/* Cabecera del algoritmo */}
        <div
          style={{
            padding: '20px 34px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: C.txt,
                letterSpacing: -0.3,
              }}
            >
              Cambio de Monedas
              <span style={{ color: C.blue }}> (Voraz)</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <Chip>O(n) tiempo</Chip>
              <Chip>O(1) espacio</Chip>
              <Chip accent>Estrategia voraz</Chip>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <MiniBtn>{'⟲'}</MiniBtn>
            <MiniBtn>{'‹'}</MiniBtn>
            <MiniBtn primary>{started ? '⏸' : '▶'}</MiniBtn>
            <MiniBtn>{'›'}</MiniBtn>
          </div>
        </div>

        {/* Canvas */}
        <div
          style={{
            flex: 1,
            margin: '6px 34px 20px',
            borderRadius: 16,
            background: '#f8fafc',
            border: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            position: 'relative',
          }}
        >
          {/* Restante */}
          <div style={{ textAlign: 'center' }}>
            <Label>Restante</Label>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 62,
                fontWeight: 800,
                lineHeight: 1,
                color: remaining === 0 ? C.green : C.blue,
                textShadow:
                  remaining === 0
                    ? '0 4px 18px rgba(16,185,129,.35)'
                    : 'none',
              }}
            >
              {remaining}
              {remaining === 0 ? ' ✓' : ''}
            </div>
          </div>

          {/* Sistema monetario */}
          <div style={{ textAlign: 'center' }}>
            <Label>Sistema monetario</Label>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {COINS.map((c, i) => {
                let state: 'normal' | 'cur' | 'na' = 'normal';
                if (!step.done) {
                  if (i === step.cur) state = 'cur';
                  else if (c > remaining) state = 'na';
                }
                return (
                  <Coin
                    key={c}
                    value={c}
                    state={state}
                    scale={i === step.cur ? bounce : 1}
                  />
                );
              })}
            </div>
          </div>

          {/* Monedas elegidas */}
          <div style={{ textAlign: 'center', minHeight: 88 }}>
            <Label>Monedas elegidas ({step.chosen.length})</Label>
            {step.chosen.length ? (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 8,
                  justifyContent: 'center',
                }}
              >
                {step.chosen.map((c, i) => {
                  const isLast = i === step.chosen.length - 1;
                  const sc = isLast && step.justTook ? popScale : 1;
                  return <Coin key={i} value={c} size={48} scale={sc} />;
                })}
              </div>
            ) : (
              <div style={{ color: C.muted, fontSize: 15, marginTop: 12 }}>
                Aún no se ha cogido ninguna moneda
              </div>
            )}
          </div>

          {/* Barra de descripción del paso */}
          <div
            style={{
              position: 'absolute',
              left: 18,
              right: 18,
              bottom: 16,
              background: step.done ? '#ecfdf5' : '#eff6ff',
              border: `1px solid ${step.done ? '#a7f3d0' : '#bfdbfe'}`,
              borderRadius: 12,
              padding: '12px 18px',
              color: step.done ? '#065f46' : '#1e3a8a',
              fontSize: 18,
              fontWeight: 600,
              textAlign: 'center',
              opacity: started ? 1 : 0.35,
            }}
          >
            {step.desc}
          </div>
        </div>
      </div>

      {/* Lower-third de marca */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          bottom: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          borderRadius: 999,
          background: 'rgba(13,19,36,.92)',
          boxShadow: '0 8px 24px rgba(15,23,42,.25)',
          opacity: brandIn,
          transform: `translateY(${(1 - brandIn) * 12}px)`,
        }}
      >
        <span style={{ fontSize: 22 }}>🧩</span>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 19 }}>
          Esquemas interactivos
        </span>
        <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 16 }}>
          · paso a paso
        </span>
      </div>

      {/* Overlay de intro con botón play + cursor */}
      {overlayOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            background: 'rgba(15,23,42,.34)',
            backdropFilter: 'blur(1px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 26,
            opacity: overlayOpacity,
          }}
        >
          <PlayControl scale={playScale} glow={glowPulse} />
          <div
            style={{
              color: '#fff',
              fontSize: 30,
              fontWeight: 800,
              textShadow: '0 2px 12px rgba(0,0,0,.4)',
            }}
          >
            Pulsa play y velo resolverse
          </div>
        </AbsoluteFill>
      )}

      {frame <= INTRO_END + PRESS_DUR && (
        <Cursor x={curX} y={curY} press={pressProgress} />
      )}
    </AbsoluteFill>
  );
};

// ── Sub-componentes de UI ─────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 13,
      color: C.muted,
      textTransform: 'uppercase',
      fontWeight: 800,
      letterSpacing: 0.8,
    }}
  >
    {children}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({
  children,
  accent,
}) => (
  <span
    style={{
      fontSize: 13,
      fontWeight: 700,
      padding: '4px 11px',
      borderRadius: 999,
      background: accent ? '#eff6ff' : '#f1f5f9',
      color: accent ? C.blueDark : C.txt2,
      border: `1px solid ${accent ? '#bfdbfe' : C.border}`,
      fontFamily: MONO,
    }}
  >
    {children}
  </span>
);

const MiniBtn: React.FC<{
  children: React.ReactNode;
  primary?: boolean;
}> = ({ children, primary }) => (
  <div
    style={{
      width: 40,
      height: 40,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      fontWeight: 700,
      color: primary ? '#fff' : C.txt2,
      background: primary
        ? `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`
        : '#f1f5f9',
      border: `1px solid ${primary ? C.blueDark : C.border}`,
      boxShadow: primary ? '0 4px 10px rgba(29,78,216,.3)' : 'none',
    }}
  >
    {children}
  </div>
);
