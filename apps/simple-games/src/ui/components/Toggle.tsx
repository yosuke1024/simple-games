export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

/** Accessible switch used in Settings; label + state are TalkBack friendly. */
export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="settings-row toggle-row"
      onClick={() => onChange(!checked)}
    >
      <span className="settings-row-label">{label}</span>
      <span className={`toggle-track ${checked ? 'on' : ''}`} aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}
