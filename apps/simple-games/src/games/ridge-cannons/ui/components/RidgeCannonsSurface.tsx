import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { ground, wind, type Point, type Session, type Shot, type Action } from '../../game';
const line = (path: Point[]) =>
  path.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${(420 - p.y).toFixed(1)}`).join(' ');
// Begin at insertion time, not at the SVG document's original clock.
const beginMotion = (node: SVGAnimateTransformElement | null) => node?.beginElement?.();
export function RidgeCannonsSurface({
  session,
  playback,
  ready,
  play,
  perspective = 0,
  names,
  windValue,
  statusLabel,
}: {
  session: Session;
  playback: { shot: Shot; durationMs: number } | null;
  ready: boolean;
  play: (a: Action) => boolean;
  perspective?: number;
  names?: readonly string[];
  windValue?: number;
  statusLabel?: string;
}) {
  const { t } = useSettings();
  const [angle, setAngle] = useState(50),
    [power, setPower] = useState(80);
  const name = (i: number) => names?.[i] ?? t(i === 0 ? 'ridgeCannonsYou' : 'ridgeCannonsCpu');
  const terrain = `M0 420 ${session.terrain.map((y, i) => `L${i * 10} ${420 - y}`).join(' ')} L1000 420Z`;
  const shot = session.shots.at(-1),
    playerShot = session.shots.filter((s) => s.side === 0).at(-1),
    cpuShot = session.shots.filter((s) => s.side === 1).at(-1);
  const visiblePaths = [playerShot, cpuShot, playback?.shot].flatMap((s) => s?.path ?? []);
  const sky = Math.min(0, ...visiblePaths.map((p) => 420 - p.y - 26));
  const left = Math.min(0, ...visiblePaths.map((p) => p.x - 26));
  const right = Math.max(1000, ...visiblePaths.map((p) => p.x + 26));
  const w = windValue ?? wind(session);
  return (
    <div className="rc-body">
      <div className="rc-scoreboard">
        {session.hp.map((hp, i) => (
          <div key={i} className={`rc-health rc-side-${i}`}>
            <span>{name(i)}</span>
            <strong>
              {hp}
              <small> / 100</small>
            </strong>
            <span className="rc-health-track">
              <span style={{ width: `${hp}%` }} />
            </span>
          </div>
        ))}
      </div>
      <div className="rc-landscape">
        <div className="rc-wind">
          {t('ridgeCannonsWind')}{' '}
          <strong>
            {w === 0 ? '·' : w > 0 ? '→' : '←'} {Math.abs(w)}
          </strong>
        </div>
        <svg
          viewBox={`${left} ${sky} ${right - left} ${420 - sky}`}
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label={t('ridgeCannonsField')}
        >
          <path
            d="M0 255 Q130 200 240 250 T490 220 T760 240 T1000 215 V420H0Z"
            className="rc-far-ridge"
          />
          <path d={terrain} className="rc-terrain" />
          {[playerShot, cpuShot].map((s, i) =>
            s ? <path key={i} d={line(s.path)} className={`rc-trail rc-side-${i}`} /> : null,
          )}
          {[0, 1].map((side) => {
            const x = side === 0 ? 105 : 895,
              y = 420 - ground(session, x) - 8,
              a =
                playback?.shot.side === side
                  ? playback.shot.action.angle
                  : side === perspective
                    ? angle
                    : ((side === 0 ? playerShot : cpuShot)?.action.angle ?? 45),
              sign = side === 0 ? 1 : -1;
            return (
              <g key={side} className={`rc-cannon rc-side-${side}`}>
                <path d={`M${x - 28} ${y + 10}h56l-9-14h-38Z`} />
                <path
                  d={`M${x} ${y}l${sign * Math.cos((a * Math.PI) / 180) * 55} ${-Math.sin((a * Math.PI) / 180) * 55}`}
                  className="rc-barrel"
                />
                <circle cx={x} cy={y + 3} r="18" />
                <circle cx={x} cy={y + 3} r="7" className="rc-hub" />
              </g>
            );
          })}
          {playback ? (
            <g className={`rc-projectile rc-side-${playback.shot.side}`} aria-hidden="true">
              <circle r="13" />
              <path d="M-6 -4a7 7 0 0 1 6-4" className="rc-projectile-glint" />
              <animateTransform
                ref={beginMotion}
                begin="indefinite"
                attributeName="transform"
                type="translate"
                values={playback.shot.path
                  .map((p) => `${p.x.toFixed(1)} ${(420 - p.y).toFixed(1)}`)
                  .join(';')}
                dur={`${playback.durationMs}ms`}
                calcMode="linear"
                fill="freeze"
              />
            </g>
          ) : shot ? (
            <circle
              key={session.actions.length}
              cx={shot.path.at(-1)!.x}
              cy={420 - shot.path.at(-1)!.y}
              r="22"
              className="rc-impact"
            />
          ) : null}
        </svg>
      </div>
      <p className="rc-status" role="status" aria-live="polite">
        {playback
          ? name(playback.shot.side)
          : ready
            ? t('ridgeCannonsAim')
            : (statusLabel ?? t('ridgeCannonsThinking'))}
        {shot && !playback ? (
          <span>
            {name(shot.side)} · {t('ridgeCannonsDamage')}: {shot.damage[shot.side === 0 ? 1 : 0]}
          </span>
        ) : null}
      </p>
      <fieldset className="rc-aim" disabled={!ready}>
        <legend className="visually-hidden">{t('ridgeCannonsAim')}</legend>
        {[
          {
            key: 'angle' as const,
            label: t('ridgeCannonsAngle'),
            value: angle,
            set: setAngle,
            min: 10,
            max: 80,
            unit: '°',
          },
          {
            key: 'power' as const,
            label: t('ridgeCannonsPower'),
            value: power,
            set: setPower,
            min: 20,
            max: 100,
            unit: '',
          },
        ].map((c) => (
          <div className="rc-control" key={c.key}>
            <label htmlFor={`rc-${c.key}`}>
              {c.label}
              <strong>
                {c.value}
                {c.unit}
              </strong>
            </label>
            <div className="rc-slider-row">
              <button
                type="button"
                className="rc-adjust"
                aria-label={`${c.label} −`}
                onClick={() => c.set(Math.max(c.min, c.value - 1))}
              >
                −
              </button>
              <input
                id={`rc-${c.key}`}
                type="range"
                min={c.min}
                max={c.max}
                value={c.value}
                onChange={(e) => c.set(Number(e.target.value))}
              />
              <button
                type="button"
                className="rc-adjust"
                aria-label={`${c.label} +`}
                onClick={() => c.set(Math.min(c.max, c.value + 1))}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </fieldset>
      <button
        type="button"
        className="btn btn-primary rc-fire"
        disabled={!ready}
        onClick={() => {
          if (play({ angle, power })) sounds.select();
        }}
      >
        {t('ridgeCannonsFire')}
      </button>
    </div>
  );
}
