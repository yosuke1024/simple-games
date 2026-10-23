/**
 * The original Chess knight, shared as artwork only. No game rules, colours,
 * dimensions or input behaviour live here; each board supplies its SVG frame.
 * Keep the silhouette and pedestal identical wherever this piece appears.
 */
export const CHESS_PIECE_BASE_PATH =
  'M11 35 H29 a1.5 1.5 0 0 0 1.5 -1.5 V32.5 a1.5 1.5 0 0 0 -1.5 -1.5 H11 a1.5 1.5 0 0 0 -1.5 1.5 V33.5 a1.5 1.5 0 0 0 1.5 1.5 Z';

interface KnightArtworkProps {
  detailClassName?: string;
  eyeClassName?: string;
}

export function KnightArtwork({
  detailClassName = 'knight-detail',
  eyeClassName = 'knight-eye',
}: KnightArtworkProps) {
  return (
    <>
      <path d="M13 31 C13 25.5 16.5 22.5 18.5 19.5 C15.5 21 12 21.5 10 19.5 C8.8 18 9.5 16.2 12.5 13.8 C15 11.8 16.5 9 18.5 7.2 L19.5 4 L22 6.8 C28.5 8.6 30.5 16 29.5 31 Z" />
      <path className={detailClassName} d="M23 10.5 C25.8 15 26 22 25 28" />
      <circle className={eyeClassName} cx="17" cy="11.8" r="1.2" />
      <path d={CHESS_PIECE_BASE_PATH} />
    </>
  );
}
