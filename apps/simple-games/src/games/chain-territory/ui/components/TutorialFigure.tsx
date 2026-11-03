export function TutorialFigure({ step }: { step: number }) {
  const cells =
    step === 0
      ? [
          [0, 0, 1],
          [1, 0, 2],
          [2, 0, 0],
        ]
      : step === 1
        ? [
            [0, 0, 1],
            [1, 0, 1],
            [0, 1, 1],
          ]
        : [
            [0, 0, 1],
            [1, 0, 1],
            [2, 0, 1],
            [0, 1, 1],
            [1, 1, 1],
            [2, 1, 1],
          ];
  return (
    <svg className="ct-tutorial-figure" viewBox="0 0 260 160" aria-hidden="true">
      <rect
        x="39"
        y="15"
        width="180"
        height="120"
        rx="12"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="2"
      />
      <path d="M99 15v120m60-120v120M39 75h180" stroke="var(--line)" />
      {cells.map(([x, y, owner], i) =>
        owner ? (
          <g key={i} fill={owner === 1 ? 'currentColor' : 'var(--ink-soft)'}>
            {owner === 1 ? (
              <circle cx={69 + x! * 60} cy={45 + y! * 60} r="12" />
            ) : (
              <path d="m129 31 14 14-14 14-14-14Z" />
            )}
          </g>
        ) : null,
      )}
      {step === 1 ? (
        <>
          <path
            d="M69 45h49m-49 0v45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="4 3"
          />
          <path
            d="m113 39 8 6-8 6m-50 35 6 8 6-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </>
      ) : null}
      {step === 0 ? (
        <circle
          cx="69"
          cy="45"
          r="23"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      ) : null}
    </svg>
  );
}
