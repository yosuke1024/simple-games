/** Font-independent shapes keep the six colours readable on every device. */
export function ColourMark({ colour }: { colour: number }) {
  return (
    <svg className="cf-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {colour === 0 && <circle cx="12" cy="12" r="5" />}
      {colour === 1 && <path d="m12 5 7 7-7 7-7-7Z" />}
      {colour === 2 && <path d="m12 5 7 13H5Z" />}
      {colour === 3 && <rect x="6" y="6" width="12" height="12" rx="1" />}
      {colour === 4 && (
        <path d="m12 4 2.5 5.3 5.8.7-4.2 4 1.1 5.7-5.2-2.8-5.2 2.8L7.9 14l-4.2-4 5.8-.7Z" />
      )}
      {colour === 5 && <path d="M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5Z" />}
    </svg>
  );
}
