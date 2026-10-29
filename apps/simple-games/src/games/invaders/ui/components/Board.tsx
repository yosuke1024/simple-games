import { useId, useRef, type PointerEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { HEIGHT, PLAYER_Y, WIDTH, type Session } from '../../game';
import { Invader, Ship } from './Shapes';
export function Board({ session, onAim }: { session: Session; onAim: (x: number) => void }) {
  const { t } = useSettings();
  const fieldId = useId();
  const pointerRef = useRef<number | null>(null);
  const aim = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(box.width / WIDTH, box.height / HEIGHT);
    if (scale > 0) {
      const left = box.left + (box.width - WIDTH * scale) / 2;
      onAim((event.clientX - left) / scale);
    }
  };
  return (
    <svg
      className="iv-board"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t('invadersBoard', { count: session.enemies.length })}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointerRef.current !== null) return;
        pointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.focus({ preventScroll: true });
        aim(event);
      }}
      onPointerMove={(event) => {
        if (pointerRef.current === event.pointerId) aim(event);
      }}
      onPointerUp={(event) => {
        if (pointerRef.current === event.pointerId) pointerRef.current = null;
      }}
      onPointerCancel={() => {
        pointerRef.current = null;
      }}
      onLostPointerCapture={() => {
        pointerRef.current = null;
      }}
    >
      <title>{t('invadersControls')}</title>
      <defs>
        {/* The floor is a shallow tray: the far wall's shadow sinks the top, the rest is the
            lit surface all the way down so the lower edge never melts into the page (§8). The
            tray's thickness and ring are the board box's own frame (invaders.css), which is
            the viewBox's outline because the box keeps the 3:4 ratio (§11). */}
        <linearGradient id={fieldId} x2="0" y2="1">
          <stop stopColor="var(--surface-recessed)" />
          <stop offset=".12" stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--surface)" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="358"
        height="478"
        rx="12"
        className="iv-field-bg"
        fill={`url(#${fieldId})`}
      />
      <rect x="7" y="7" width="346" height="466" rx="7" className="iv-field-inset" />
      {/* The ship's rail is a groove the hull sits in, not a line it crosses. */}
      <rect x="14" y="441.5" width="332" height="7" rx="3.5" className="iv-track" />
      <path
        d="M16 452v8m41-8v5m41-5v5m41-5v5m41-5v8m41-8v5m41-5v5m41-5v5m41-5v8"
        className="iv-field-scale"
      />
      <path d="M16 412h328" className="iv-defense-line" />
      <path d="M16 23h12m-6-6v12m310-6h12m-6-6v12" className="iv-corner-mark" />
      {session.enemies.map((enemy) => (
        <g key={enemy.id} transform={`translate(${enemy.x} ${enemy.y})`} className="iv-enemy">
          <Invader kind={Math.floor(enemy.id / 7)} />
        </g>
      ))}
      {session.covers
        .filter((brick) => brick.hp > 0)
        .map((brick) => (
          <g
            key={brick.id}
            transform={`translate(${brick.x} ${brick.y})`}
            className={`iv-cover iv-cover-${brick.hp}`}
          >
            <rect x="-6.5" y="-6.5" width="13" height="13" rx="2" />
            {brick.hp === 1 ? (
              <path d="m-2-6 2 5-3 3 4 4" />
            ) : (
              <>
                {/* A lit top and a shaded foot; a damaged block loses both (§4, §8). */}
                <path d="M-5-5h10" className="iv-cover-hi" />
                <path d="M-5 5h10" className="iv-cover-lo" />
              </>
            )}
          </g>
        ))}
      {session.bullets.map((bullet) =>
        bullet.owner === 'player' ? (
          <path key={bullet.id} d={`M${bullet.x} ${bullet.y - 4}v8`} className="iv-player-shot" />
        ) : (
          <path
            key={bullet.id}
            d={`m${bullet.x} ${bullet.y - 5}-2 4 4 4-2 3`}
            className="iv-enemy-shot"
          />
        ),
      )}
      <g transform={`translate(${session.playerX} ${PLAYER_Y})`} className="iv-ship">
        <Ship />
        {session.invulnerableTicks > 0 ? <ellipse rx="18" ry="21" className="iv-shield" /> : null}
      </g>
    </svg>
  );
}
