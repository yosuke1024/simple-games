export function TutorialFigure({ step }: { step: number }) {
  return (
    <svg
      viewBox="0 0 300 150"
      aria-hidden="true"
      style={{ width: '100%', maxHeight: 160, color: 'var(--accent)', margin: '12px auto' }}
    >
      <path d="M0 140 65 78 100 110 150 35 213 103 255 82 300 140Z" fill="var(--accent-soft)" />
      <path
        d="M30 115Q130 -35 270 115"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="5 7"
      />
      <circle cx="30" cy="115" r="14" fill="currentColor" />
      <circle cx="270" cy="115" r="14" fill="var(--ink)" />
      {step === 1 ? (
        <path d="M130 20h60m-12-9 12 9-12 9" stroke="currentColor" strokeWidth="4" fill="none" />
      ) : null}
      {step === 2 ? (
        <>
          <rect x="10" y="135" width="60" height="5" rx="2" fill="currentColor" />
          <rect x="235" y="135" width="25" height="5" rx="2" fill="var(--ink)" />
        </>
      ) : null}
    </svg>
  );
}
