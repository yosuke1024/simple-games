import type { Cargo } from '../../game';

/** Original, small-size illustrations. Silhouette and facial features identify each cargo. */
export function CargoIcon({ cargo }: { cargo: Cargo }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={'rg-cargo-icon rg-cargo-' + cargo}
      aria-hidden="true"
      fill="none"
      stroke="var(--rg-outline)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {cargo === 'wolf' ? (
        <>
          <path d="M15 33Q7 10 14 8q13 1 20 15m12 0Q53 9 66 8q7 2-1 25" fill="var(--rg-wolf)" />
          <path d="m16 16 5 17 10-8Zm48 0-5 17-10-8Z" fill="var(--rg-ear)" stroke="none" />
          <path
            d="M14 34q3-14 26-14t26 14l7 13-7 2q5 20-26 23Q9 69 14 49l-7-2Z"
            fill="var(--rg-wolf)"
          />
          <path
            d="M15 47q13-4 25 10 12-14 25-10 3 20-25 23Q12 67 15 47"
            fill="var(--rg-cream)"
            stroke="none"
          />
          <path d="m32 23 6 5 4-5 6 4" stroke="var(--rg-wolf-shadow)" />
          <ellipse cx="27" cy="43" rx="5" ry="6" fill="var(--rg-outline)" stroke="none" />
          <ellipse cx="53" cy="43" rx="5" ry="6" fill="var(--rg-outline)" stroke="none" />
          <circle cx="25.5" cy="41" r="1.7" fill="var(--rg-white)" stroke="none" />
          <circle cx="51.5" cy="41" r="1.7" fill="var(--rg-white)" stroke="none" />
          <ellipse cx="20" cy="51" rx="5" ry="3" fill="var(--rg-blush)" stroke="none" />
          <ellipse cx="60" cy="51" rx="5" ry="3" fill="var(--rg-blush)" stroke="none" />
          <path d="M36 53q4-3 8 0 0 4-4 5-4-1-4-5" fill="var(--rg-outline)" stroke="none" />
          <path d="M40 58q-3 7-7 2m7-2q3 7 7 2" strokeWidth="1.8" />
        </>
      ) : null}
      {cargo === 'goat' ? (
        <>
          <path
            d="M25 28Q15 12 23 7q2-2 3 2-2 10 9 15m20 4Q65 12 57 7q-2-2-3 2 2 10-9 15"
            fill="var(--rg-horn)"
          />
          <path
            d="M24 33Q9 22 5 32q-2 13 17 16m34-15q15-11 19-1 2 13-17 16"
            fill="var(--rg-cream)"
          />
          <path d="M11 34q3-2 10 5m48-5q-3-2-10 5" stroke="var(--rg-ear)" strokeWidth="5" />
          <path d="m33 64 4 11 4-4 4 4 4-11" fill="var(--rg-cream)" />
          <path d="M17 41q0-20 23-20t23 20l-3 12q-3 17-20 17T20 53Z" fill="var(--rg-cream)" />
          <path d="M26 28q3-10 10-4 6-9 11-2 9-3 9 6" fill="var(--rg-white)" stroke="none" />
          <ellipse cx="40" cy="56" rx="11" ry="8" fill="var(--rg-muzzle)" stroke="none" />
          <ellipse cx="28" cy="42" rx="4.5" ry="5.5" fill="var(--rg-outline)" stroke="none" />
          <ellipse cx="52" cy="42" rx="4.5" ry="5.5" fill="var(--rg-outline)" stroke="none" />
          <circle cx="26.5" cy="40" r="1.6" fill="var(--rg-white)" stroke="none" />
          <circle cx="50.5" cy="40" r="1.6" fill="var(--rg-white)" stroke="none" />
          <ellipse cx="23" cy="51" rx="4.5" ry="2.8" fill="var(--rg-blush)" stroke="none" />
          <ellipse cx="57" cy="51" rx="4.5" ry="2.8" fill="var(--rg-blush)" stroke="none" />
          <path d="m37 54 3 2 3-2m-3 2v3m-4 0q4 4 8 0" strokeWidth="1.8" />
        </>
      ) : null}
      {cargo === 'cabbage' ? (
        <>
          <path
            d="M40 72C18 74 5 63 8 48 0 35 10 22 23 22 26 9 43 5 55 16c15-2 24 11 18 24 9 18-4 34-33 32Z"
            fill="var(--rg-leaf-dark)"
          />
          <path
            d="M18 50C7 33 19 17 33 19c9-10 29-3 30 12 14 10 8 28-6 34Z"
            fill="var(--rg-leaf)"
          />
          <path d="M20 43q0-24 20-24t22 25q-1 20-22 22T20 43Z" fill="var(--rg-leaf-light)" />
          <path d="M32 25q5-4 11-1m-18 9q-3 5-2 9m25-16 7 6" stroke="var(--rg-leaf)" />
          <path
            d="M9 48q17-2 30 20C57 65 69 56 69 44q9 22-29 28Q11 73 9 48Z"
            fill="var(--rg-leaf)"
          />
          <path
            d="m16 54 16 11m-9-6 1-6m26 13 12-11m-6 6 7 1"
            stroke="var(--rg-leaf-dark)"
            strokeWidth="1.8"
          />
          <ellipse cx="29" cy="44" rx="3.5" ry="4.5" fill="var(--rg-outline)" stroke="none" />
          <ellipse cx="51" cy="44" rx="3.5" ry="4.5" fill="var(--rg-outline)" stroke="none" />
          <circle cx="28" cy="42.5" r="1.2" fill="var(--rg-white)" stroke="none" />
          <circle cx="50" cy="42.5" r="1.2" fill="var(--rg-white)" stroke="none" />
          <ellipse cx="23" cy="51" rx="4" ry="2.5" fill="var(--rg-blush)" stroke="none" />
          <ellipse cx="57" cy="51" rx="4" ry="2.5" fill="var(--rg-blush)" stroke="none" />
          <path d="M35 51q5 7 10 0" strokeWidth="2" />
        </>
      ) : null}
      {cargo === 'fox' ? (
        <>
          <path
            d="M14 35Q8 10 15 8l19 16h12L65 8q7 2 1 27l7 13-7 4Q63 70 40 73 17 70 14 52l-7-4Z"
            fill="var(--rg-fox)"
          />
          <path d="m17 18 4 16 9-8Zm46 0-4 16-9-8Z" fill="var(--rg-ear)" stroke="none" />
          <path
            d="M13 47q17-1 27 13 10-14 27-13-1 21-27 26Q14 68 13 47Z"
            fill="var(--rg-cream)"
            stroke="none"
          />
          <ellipse cx="27" cy="43" rx="4.5" ry="5.5" fill="var(--rg-outline)" stroke="none" />
          <ellipse cx="53" cy="43" rx="4.5" ry="5.5" fill="var(--rg-outline)" stroke="none" />
          <circle cx="25.5" cy="41" r="1.6" fill="var(--rg-white)" stroke="none" />
          <circle cx="51.5" cy="41" r="1.6" fill="var(--rg-white)" stroke="none" />
          <ellipse cx="20" cy="52" rx="4" ry="2.5" fill="var(--rg-blush)" stroke="none" />
          <ellipse cx="60" cy="52" rx="4" ry="2.5" fill="var(--rg-blush)" stroke="none" />
          <path d="M36 56q4-3 8 0 0 4-4 5-4-1-4-5" fill="var(--rg-outline)" stroke="none" />
          <path d="M40 61q-3 5-6 1m6-1q3 5 6 1" strokeWidth="1.8" />
        </>
      ) : null}
      {cargo === 'hen' ? (
        <>
          <path d="M44 20q-6-12 1-13 4-1 6 5 3-10 9-6 5 4-2 15" fill="var(--rg-comb)" />
          <path
            d="m28 63-2 10m18-10 1 10m-25 0h12m7 0h12"
            stroke="var(--rg-beak)"
            strokeWidth="3"
          />
          <path
            d="M22 37 9 24 7 40l7 8q-3 19 23 20 28 1 28-24V29q-1-17-16-12-11 3-10 17Z"
            fill="var(--rg-cream)"
          />
          <path d="m64 29 12 6-12 6" fill="var(--rg-beak)" />
          <path d="M64 40q4 11-3 13-7-2-4-12" fill="var(--rg-comb)" />
          <path d="M21 45q11-11 24-2 3 17-16 16Z" fill="var(--rg-muzzle)" />
          <path d="m27 47 10 4-7 3" />
          <circle cx="56" cy="29" r="3" fill="var(--rg-outline)" stroke="none" />
          <circle cx="57" cy="28" r="1" fill="var(--rg-white)" stroke="none" />
        </>
      ) : null}
      {cargo === 'grain' ? (
        <>
          <path d="m25 9 30 0-7 16q25 29 13 43H19Q7 54 32 25Z" fill="var(--rg-sack)" />
          <path d="m30 24 20 0m-22 5 24 0" stroke="var(--rg-horn)" strokeWidth="4" />
          <path
            d="M40 60V37m0 9q-10 0-9-7 9 0 9 7Zm0 8q-10 0-9-7 9 0 9 7Zm0-12q10 0 9-7-9 0-9 7Zm0 9q10 0 9-7-9 0-9 7Z"
            fill="var(--rg-beak)"
            stroke="var(--rg-horn)"
            strokeWidth="1.6"
          />
          <path d="M20 58q-1 5 3 7m35-7q1 5-3 7" stroke="var(--rg-horn)" />
        </>
      ) : null}
      {cargo === 'crate' ? (
        <>
          <path d="m9 22 31-12 31 12v43l-31 9L9 65Z" fill="var(--rg-wood)" />
          <path d="m9 22 31 10 31-10-31-12Z" fill="var(--rg-sack)" />
          <path d="M40 32v42m-31-38 31 9 31-9m-62 14 31 9 31-9" />
          <path d="m15 29 7 2v32l-7-2Zm43 2 7-2v32l-7 2Z" fill="var(--rg-sack)" />
          <path d="m19 18 31 11m-20-15 31 11" stroke="var(--rg-horn)" />
          <path d="m27 37 6 2m14 11 6-2m-26 9 6 2" stroke="var(--rg-horn)" />
        </>
      ) : null}
    </svg>
  );
}
