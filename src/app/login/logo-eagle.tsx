/**
 * The CIA First logo, shown exactly as the original artwork (public/login/cia-logo.png). The only
 * motion is a light sheen sweeping across the badge; the gentle float comes from `le-floating` on the
 * wrapper. Both live in globals.css (`le-*` classes) and stop when the viewer prefers reduced motion.
 */

// The badge is a hair off-centre in the original artwork.
const CX = 253.5;
const CY = 256;

export function LogoEagle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" role="img" aria-label="CIA First International School logo" className={className}>
      <defs>
        <linearGradient id="le-sheen-band" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="le-badge">
          <circle cx={CX} cy={CY} r="254" />
        </clipPath>
      </defs>

      <image href="/login/cia-logo.png" x="0" y="0" width="512" height="512" />

      <g clipPath="url(#le-badge)">
        <g transform={`rotate(20 ${CX} ${CY})`}>
          <rect className="le-sheen" x="-160" y="-60" width="120" height="640" fill="url(#le-sheen-band)" opacity="0" />
        </g>
      </g>
    </svg>
  );
}
