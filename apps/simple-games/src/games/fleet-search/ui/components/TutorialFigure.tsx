export function TutorialFigure({ step }: { step: number }) {
  return (
    <svg
      viewBox="0 0 300 150"
      aria-hidden="true"
      style={{ width: '100%', maxHeight: 160, color: 'var(--accent)', margin: '12px auto' }}
    >
      <rect
        x="80"
        y="4"
        width="140"
        height="140"
        rx="6"
        fill="var(--surface)"
        stroke="currentColor"
      />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} stroke="currentColor" opacity=".18">
          <path d={`M${80 + (i + 1) * 17.5} 4v140M80 ${4 + (i + 1) * 17.5}h140`} />
        </g>
      ))}
      {step === 0 ? (
        <>
          <path
            d="M97 22h70v17H97Z M167 74h17v52h-17Z M97 91h35v17H97Z"
            fill="currentColor"
            opacity=".7"
          />
        </>
      ) : (
        <>
          {[20, 21, 22, 23].map((c) => (
            <g
              key={c}
              transform={`translate(${80 + (c % 8) * 17.5} ${4 + Math.floor(c / 8) * 17.5})`}
            >
              <rect
                width="17.5"
                height="17.5"
                fill="currentColor"
                opacity={step === 2 ? 0.8 : 0.14}
              />
              <path
                d="m4 4 9 9m-9 0 9-9"
                stroke={step === 2 ? 'var(--accent-ink)' : 'currentColor'}
                strokeWidth="2"
              />
            </g>
          ))}
          <circle cx="123.75" cy="100.25" r="3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
