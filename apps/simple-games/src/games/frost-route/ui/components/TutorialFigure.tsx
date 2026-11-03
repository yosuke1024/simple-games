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
        rx="8"
        fill="var(--surface)"
        stroke="currentColor"
      />
      <path
        d="M100 124H200V24"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="5 5"
        fill="none"
      />
      <path d="m90 26 20-8 15 22-10 18-30-4Z" fill="var(--ink-soft)" opacity=".6" />
      <circle cx={step === 2 ? 200 : 100} cy={step === 2 ? 24 : 124} r="10" fill="currentColor" />
      {step !== 2 ? (
        <>
          {[135, 165].map((x) => (
            <path key={x} d={`m${x} 116 6 8-6 8-6-8Z`} fill="currentColor" />
          ))}
          <path d="m200 64 6 8-6 8-6-8Z" fill="currentColor" />
        </>
      ) : null}
      <path
        d="M200 40V15h18l-5 6 5 6h-18"
        stroke="currentColor"
        strokeWidth="2"
        fill="var(--accent-soft)"
      />
    </svg>
  );
}
