import { useRef, type PointerEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { HEIGHT, PLAYER_Y, WIDTH, type Session } from '../../game';
import { Invader, Ship } from './Shapes';
export function Board({ session, onAim }: { session: Session; onAim: (x: number) => void }) {
  const { t } = useSettings();
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
      <rect x="1" y="1" width="358" height="478" rx="12" className="iv-field-bg" />
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
            {brick.hp === 1 ? <path d="m-2-6 2 5-3 3 4 4" /> : null}
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
