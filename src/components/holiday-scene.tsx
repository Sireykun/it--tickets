import type { Season } from "@/lib/holidays";

// Full-panel holiday artwork for the login hero, shown instead of the school backdrop. It's an
// illustration on a fixed dark panel, so its palette is fixed rather than tokens.
// Only the stars and lamp flames move, through `holiday-twinkle`, which respects reduced motion.
export function HolidayScene({ season }: { season: Season }) {
  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className="holiday-motif absolute inset-0 block h-full w-full"
    >
      {season === "khmer-new-year" ? <NewYear /> : season === "pchum-ben" ? <PchumBen /> : <WaterFestival />}
    </svg>
  );
}

function NewYear() {
  return (
    <>
      <defs>
        <linearGradient id="kny-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b0710" />
          <stop offset=".45" stopColor="#8f1d22" />
          <stop offset=".62" stopColor="#d9612a" />
          <stop offset=".7" stopColor="#f3b44f" />
        </linearGradient>
        <linearGradient id="kny-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a1418" />
          <stop offset="1" stopColor="#14040a" />
        </linearGradient>
        <radialGradient id="kny-sun">
          <stop offset="0" stopColor="#ffe6a6" />
          <stop offset=".6" stopColor="#ffc35e" stopOpacity=".8" />
          <stop offset="1" stopColor="#ffc35e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#kny-sky)" />
      <circle cx="400" cy="640" r="190" fill="url(#kny-sun)" />
      <Stars points={[[90, 90], [210, 160], [640, 80], [720, 210], [520, 140], [330, 60], [60, 260]]} />
      <g fill="#2a080d">
        <path d={TEMPLE} />
        <rect x="150" y="676" width="500" height="24" />
      </g>
      <rect y="700" width="800" height="300" fill="url(#kny-water)" />
      <g fill="#ffc35e" opacity=".35">
        <rect x="330" y="716" width="140" height="3" rx="1.5" />
        <rect x="360" y="736" width="80" height="3" rx="1.5" />
        <rect x="380" y="756" width="40" height="2" rx="1" />
      </g>
      <g stroke="#1a0508" strokeLinecap="round" fill="none">
        <Palm x={70} base={720} height={300} lean={30} />
        <Palm x={160} base={710} height={220} lean={-20} />
        <Palm x={700} base={720} height={280} lean={-34} />
      </g>
      <g fill="#ffc35e" opacity=".9">
        {[[110, 420], [250, 330], [560, 360], [690, 470], [460, 250]].map(([x, y]) => (
          <Flower key={`${x}-${y}`} x={x} y={y} />
        ))}
      </g>
    </>
  );
}

function PchumBen() {
  return (
    <>
      <defs>
        <linearGradient id="pb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140b24" />
          <stop offset=".4" stopColor="#3d2350" />
          <stop offset=".62" stopColor="#a5502a" />
          <stop offset=".7" stopColor="#e9a15a" />
        </linearGradient>
        <radialGradient id="pb-glow">
          <stop offset="0" stopColor="#ffd27a" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#pb-sky)" />
      <Stars points={[[80, 80], [190, 200], [300, 110], [560, 70], [700, 160], [640, 280], [120, 330]]} />
      <g fill="#1d0d1c">
        <path d={PAGODA} />
        <rect y="700" width="800" height="300" />
      </g>
      <g fill="#a5502a" opacity=".5">
        <rect x="372" y="640" width="56" height="60" rx="28" />
      </g>
      {[100, 190, 280, 370, 460, 550, 640, 730].map((x, i) => (
        <Lamp key={x} x={x} y={i % 2 ? 790 : 770} />
      ))}
      <g fill="#e7a3b4" opacity=".85">
        <Lotus x={150} y={930} />
        <Lotus x={420} y={960} />
        <Lotus x={660} y={920} />
      </g>
    </>
  );
}

function WaterFestival() {
  return (
    <>
      <defs>
        <linearGradient id="bot-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#040a22" />
          <stop offset=".5" stopColor="#0a2546" />
          <stop offset=".52" stopColor="#0e4a5a" />
        </linearGradient>
        <linearGradient id="bot-river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b3a4a" />
          <stop offset="1" stopColor="#03141c" />
        </linearGradient>
        <radialGradient id="bot-moon">
          <stop offset="0" stopColor="#fff6d1" />
          <stop offset=".5" stopColor="#ffe9a3" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffe9a3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#bot-sky)" />
      <circle cx="610" cy="190" r="150" fill="url(#bot-moon)" />
      <circle cx="610" cy="190" r="58" fill="#fff3c4" />
      <Stars points={[[90, 120], [240, 70], [380, 180], [470, 60], [720, 330], [140, 300]]} />
      <Burst x={180} y={250} r={70} color="#ffc35e" />
      <Burst x={400} y={330} r={55} color="#ff8fb1" />
      <Burst x={300} y={150} r={40} color="#6fe0d8" />
      <path d="M0 520h800" stroke="#0f5466" strokeWidth="2" />
      <rect y="520" width="800" height="480" fill="url(#bot-river)" />
      <g fill="#fff3c4" opacity=".4">
        <rect x="580" y="540" width="60" height="3" rx="1.5" />
        <rect x="595" y="560" width="30" height="3" rx="1.5" />
        <rect x="600" y="580" width="20" height="2" rx="1" />
      </g>
      <g opacity=".9">
        <Lantern x={120} y={535} color="#ffc35e" />
        <Lantern x={300} y={542} color="#ff8fb1" />
        <Lantern x={470} y={530} color="#6fe0d8" />
      </g>
      <Boat x={90} y={620} length={360} color="#c8962e" />
      <Boat x={380} y={700} length={380} color="#b8323a" />
      <g stroke="#2a7f8f" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".6">
        <path d="M0 660c40-10 80 10 120 0s80 10 120 0" />
        <path d="M480 650c40-10 80 10 120 0s80 10 120 0" />
        <path d="M60 760c40-10 80 10 120 0s80 10 120 0 80 10 120 0" />
      </g>
    </>
  );
}

function Stars({ points }: { points: number[][] }) {
  return (
    <g className="holiday-twinkle" fill="#fff3c4">
      {points.map(([x, y], i) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 3 === 0 ? 2.6 : 1.6} />
      ))}
    </g>
  );
}

function Palm({ x, base, height, lean }: { x: number; base: number; height: number; lean: number }) {
  const tx = x + lean;
  const ty = base - height;
  return (
    <g>
      <path d={`M${x} ${base}Q${x + lean * 0.2} ${base - height / 2} ${tx} ${ty}`} strokeWidth="7" />
      {[-70, -40, -12, 12, 40, 70].map((dx) => (
        <path key={dx} d={`M${tx} ${ty}q${dx / 2} -30 ${dx} ${Math.abs(dx) / 2.2}`} strokeWidth="5" />
      ))}
    </g>
  );
}

function Flower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-7" rx="3.5" ry="7" transform={`rotate(${a})`} />
      ))}
      <circle r="3" fill="#8f1d22" />
    </g>
  );
}

function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cy="-22" r="34" fill="url(#pb-glow)" />
      <path className="holiday-twinkle" d="M0-40c-8-8-8-16 0-26 8 10 8 18 0 26Z" fill="#ffc35e" />
      <path d="M-22-14h44l-8 14h-28Z" fill="#7a3b1c" />
      <path d="M-26-16h52" stroke="#c87a3a" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Lotus({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0c-10-14-10-30 0-44 10 14 10 30 0 44Z" />
      <path d="M0 0c-22-6-34-20-36-36 16 2 30 14 36 36ZM0 0c22-6 34-20 36-36-16 2-30 14-36 36Z" opacity=".75" />
      <path d="M-46 4h92" stroke="#2c5a3a" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Burst({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const rays = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
  return (
    <g className="holiday-twinkle" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill={color}>
      {rays.map((a) => (
        <g key={a}>
          <path d={`M${x + Math.cos(a) * r * 0.35} ${y + Math.sin(a) * r * 0.35}L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`} />
          <circle cx={x + Math.cos(a) * (r + 8)} cy={y + Math.sin(a) * (r + 8)} r="2.2" stroke="none" />
        </g>
      ))}
    </g>
  );
}

function Lantern({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy="6" rx="46" ry="10" fill={color} opacity=".25" />
      <path d="M-34 0h68l-8 10h-52Z" fill="#0a1f2c" />
      <rect x="-26" y="-26" width="52" height="26" rx="4" fill={color} />
      <path d="M-14-26l14-16 14 16" fill={color} />
    </g>
  );
}

function Boat({ x, y, length, color }: { x: number; y: number; length: number; color: string }) {
  const rowers = Array.from({ length: Math.floor(length / 26) - 1 }, (_, i) => x + 30 + i * 26);
  return (
    <g>
      <g stroke="#e9d9a8" strokeWidth="2.5" strokeLinecap="round">
        {rowers.map((rx) => (
          <path key={rx} d={`M${rx} ${y - 26}l-14 34`} />
        ))}
      </g>
      <g fill="#091820">
        {rowers.map((rx) => (
          <g key={rx}>
            <circle cx={rx} cy={y - 38} r="6" />
            <rect x={rx - 5} y={y - 32} width="10" height="12" rx="4" />
          </g>
        ))}
      </g>
      <path
        d={`M${x - 26} ${y - 46}c6 18 14 34 26 40h${length}c14-6 22-16 26-34-10 12-18 18-30 18H${x + 4}c-10-2-20-10-30-24Z`}
        fill={color}
      />
      <path d={`M${x} ${y - 6}h${length}`} stroke="#091820" strokeWidth="3" opacity=".4" />
    </g>
  );
}

// A five-tower Khmer temple skyline, built from stepped tiers.
function tower(cx: number, base: number, width: number, height: number) {
  const tiers = 6;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < tiers; i++) {
    const w = (width / 2) * (1 - i / tiers);
    const y0 = base - (height * i) / tiers;
    const y1 = base - (height * (i + 1)) / tiers + 6;
    left.push(`L${cx - w} ${y0}L${cx - w} ${y1}L${cx - w * 0.82} ${y1}`);
    right.unshift(`L${cx + w * 0.82} ${y1}L${cx + w} ${y1}L${cx + w} ${y0}`);
  }
  return `M${cx - width / 2} ${base}${left.join("")}L${cx} ${base - height - 14}${right.join("")}Z`;
}

const TEMPLE = [
  tower(400, 680, 86, 230),
  tower(310, 680, 64, 170),
  tower(490, 680, 64, 170),
  tower(235, 680, 50, 120),
  tower(565, 680, 50, 120),
  "M190 680v-36h420v36Z",
].join("");

// A Khmer pagoda: stacked roofs with upswept finials, under a central stupa spire.
const PAGODA = [
  "M250 700v-96h300v96Z",
  "M214 610c-8-4-12-14-10-24 8 6 14 12 22 14l64-58h220l64 58c8-2 14-8 22-14 2 10-2 20-10 24Z",
  "M296 548c-6-4-8-12-6-20 6 5 10 8 16 9l46-44h96l46 44c6-1 10-4 16-9 2 8 0 16-6 20Z",
  "M372 496l10-46h36l10 46ZM384 450l6-60h20l6 60ZM394 390l6-70 6 70Z",
  "M140 700v-60l20-30 20 30v60ZM620 700v-60l20-30 20 30v60Z",
].join("");
