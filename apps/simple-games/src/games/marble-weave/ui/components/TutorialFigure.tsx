export function TutorialFigure({ step }: { step: number }) {
  const positions =
    step === 1
      ? [
          [1, 2],
          [2, 2],
          [3, 2],
        ]
      : step === 2
        ? []
        : [
            [1, 1],
            [3, 1],
            [4, 3],
          ];
  return (
    <svg className="mw-tutorial-figure" viewBox="0 0 260 160" aria-hidden="true">
      <rect
        x="48"
        y="12"
        width="165"
        height="132"
        rx="8"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="2"
      />
      {[1, 2, 3, 4].map((n) => (
        <path key={n} d={`M${48 + n * 33} 12v132`} stroke="var(--line)" />
      ))}
      {[1, 2, 3].map((n) => (
        <path key={n} d={`M48 ${12 + n * 33}h165`} stroke="var(--line)" />
      ))}
      {positions.map(([x, y], i) => (
        <circle
          key={i}
          cx={31.5 + x! * 33}
          cy={-4.5 + y! * 33}
          r="11"
          fill={step === 1 ? '#3d6aab' : ['#af4558', '#287a55', '#99700d'][i]}
        />
      ))}
      {step === 0 ? (
        <path
          d="M64.5 28.5v66h66"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="4 3"
        />
      ) : null}
      {step === 1 ? (
        <rect
          x="50"
          y="48"
          width="96"
          height="28"
          rx="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      ) : null}
      {step === 2 ? (
        <path
          d="m112 78 13 13 26-30"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
