/** Original top-down vessel. One continuous hull spans all of its cells. */
export function Vessel({ length }: { length: number }) {
  const width = length * 10;
  return (
    <>
      <path
        className="fs-hull"
        d={`M2 1.4H${width - 8}Q${width - 3} 1.4 ${width - 1} 5Q${width - 3} 8.6 ${width - 8} 8.6H2Q1 5 2 1.4Z`}
      />
      <path className="fs-gun" d={`M${width - 8} 5h4M6 5H3`} />
      <rect className="fs-deck" x="7" y="2.7" width={width - 17} height="4.6" rx="1.2" />
      <path className="fs-bridge" d="M8 3.4h3v3.2H8Z" />
      <circle className="fs-turret" cx={width - 8} cy="5" r="1.6" />
      <circle className="fs-turret" cx="5.5" cy="5" r="1.3" />
      <path className="fs-keel" d={`M13 5h${Math.max(0, width - 25)}`} />
    </>
  );
}
