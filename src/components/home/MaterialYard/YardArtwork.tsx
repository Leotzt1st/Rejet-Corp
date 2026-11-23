import { useId, type ReactNode } from "react";

interface YardArtworkProps {
  activeStage: 0 | 1 | 2;
  children?: ReactNode;
}

const activePaint = "#b6ff00";
const idlePaint = "#a8ba9d";
const YARD_ROUTE = "M129 192L242 257L444 140";

function Pallet({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-14 0 1-8 17 1 2 10Z" fill="#070a07" />
      <path d="M-14-2 2 7v-8l-16-9Z" fill="#665c43" />
      <path d="M2 7 17-2v-8L2-1Z" fill="#403b2d" />
      <path d="m-14-10 15-8 16 8-15 9Z" fill={fill} />
      <path d="m-7-14 16 9m-9-13 17 9" fill="none" stroke="#292e20" strokeOpacity=".55" />
    </g>
  );
}

export default function YardArtwork({ activeStage, children }: YardArtworkProps) {
  const groundId = useId();
  const gridId = useId();
  const origin = activeStage === 0 ? activePaint : idlePaint;
  const sorting = activeStage === 1 ? activePaint : idlePaint;
  const reuse = activeStage === 2 ? activePaint : idlePaint;

  return (
    <svg
      viewBox="0 0 560 340"
      width="560"
      height="340"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={groundId}>
          <path d="M16 170 281 23 544 172 279 321Z" />
        </clipPath>
        <pattern id={gridId} width="40" height="22" patternUnits="userSpaceOnUse">
          <path d="m-20 0 40 22 40-22M-20 22 20 0l40 22" fill="none" stroke="#53654c" strokeOpacity=".22" />
        </pattern>
      </defs>

      <path d="M10 179 280 28l270 152-270 152Z" fill="#080b08" />
      <path d="M16 170 279 321l265-149v9L279 330 16 179Z" fill="#151c15" stroke="#374334" />
      <path d="M279 321v9l265-149v-9Z" fill="#0c120d" />
      <path d="M16 170 281 23 544 172 279 321Z" fill="#263027" stroke="#65765d" strokeWidth="1.4" />
      <g clipPath={`url(#${groundId})`}>
        <path d="M16 20h530v305H16Z" fill={`url(#${gridId})`} />
        <path d="m18 173 264-146 259 147M44 180 279 314l238-134" fill="none" stroke="#435144" strokeDasharray="5 5" />
        <path d="m165 153 125-70 136 77-118 75Z" fill="#121b14" opacity=".75" />
        <path d="m47 179 68-38 93 51-59 38Zm275-7 84-52 88 45-82 49Z" fill="#121a13" opacity=".62" />
        <path d="m78 160 168 98 216-126m-305 44 124 71 223-130" fill="none" stroke="#111913" strokeWidth="22" />
        <path d={YARD_ROUTE} fill="none" stroke="#556940" strokeWidth="20" strokeLinejoin="round" />
        <path d={YARD_ROUTE} fill="none" stroke="#20291b" strokeWidth="18" strokeLinejoin="round" />
        <path d={YARD_ROUTE} fill="none" stroke={activePaint} strokeOpacity=".87" strokeWidth="2" strokeLinejoin="round" />
        <path d="m220 248 22 13 37-21m36-20 31-18m23-14 28-17" fill="none" stroke="#9eb871" strokeOpacity=".55" strokeDasharray="4 5" />
        <path d="m167 215 9 0-1-6m121 16 9-5-9-1m112-58 9-5-9-1" fill="none" stroke={activePaint} strokeWidth="1.5" />
        <path d="m164 243 34-19m-21 27 33-19m-20 26 33-19m160-22 58-34m-46 41 58-34m-46 41 58-34" fill="none" stroke="#a0ab8e" strokeOpacity=".44" />
        <path d="m72 188 55 31-8 5-55-31Zm235 86 50-30 9 5-51 30Zm156-114 32 17-6 4-33-17Z" fill="#536b51" />
      </g>

      {/* Outbound dock and bales of paper at the origin. */}
      <path d="m56 150 65-37 77 44-67 39Z" fill="#070b08" opacity=".8" />
      <path d="m48 105 78 45v38l-78-45Z" fill="#35453b" stroke={origin} strokeOpacity=".48" />
      <path d="m126 150 56-32v38l-56 32Z" fill="#202e25" stroke={origin} strokeOpacity=".48" />
      <path d="m48 105 56-32 78 45-56 32Z" fill="#4c5b4c" stroke={origin} strokeOpacity=".7" />
      <path d="m53 101 49-33 80 46-53 32Z" fill="#616f59" stroke="#85937a" strokeWidth=".8" />
      <path d="m62 101 51 30m-43-35 51 30m-43-35 51 30m-43-35 51 30m-43-35 51 30m-43-35 51 30m-43-35 51 30" fill="none" stroke="#293c2c" strokeOpacity=".72" />
      <path d="m103 70 77 45-9 5-76-44Z" fill="#68765d" />
      <path d="m54 120 55 32v9l-55-32Z" fill="#1a2820" />
      <path d="m57 122 46 27m-42-25v7m10-1v7m10-1v7m10-1v7" stroke="#a5b695" strokeOpacity=".75" />
      <path d="m130 156 30-17v28l-30 18Z" fill="#101c14" stroke={origin} strokeWidth="1.5" />
      <path d="m133 160 24-14m-24 19 24-14m-24 19 24-14m-24 19 24-14" stroke={origin} strokeOpacity=".5" />
      <path d="m127 188 36-21 5 3-36 21Z" fill={origin} />
      <Pallet x={79} y={174} fill="#a89d72" />
      <Pallet x={99} y={185} fill="#baa879" />

      {/* Sawtooth roofs and a raised transfer platform at the sorting center. */}
      <path d="m201 167 76-44 89 52-75 48Z" fill="#080d09" opacity=".85" />
      <path d="m202 142 74 42v36l-74-42Z" fill="#32443c" stroke={sorting} strokeOpacity=".62" />
      <path d="m276 184 79-45v35l-79 46Z" fill="#22382e" stroke={sorting} strokeOpacity=".62" />
      <path d="m202 142 79-46 74 43-79 45Z" fill="#526b58" stroke={sorting} strokeOpacity=".72" />
      <path d="m202 142 26-15 74 42-26 15Zm53-31 26-15 74 43-26 15Z" fill="#637b64" />
      <path d="m222 128 15-12 75 44-10 9Zm26-15 15-13 77 44-11 10Z" fill="#829682" stroke="#9caf97" strokeWidth=".8" />
      <path d="m237 116 1 9 74 43v-8Zm26-16 1 9 76 45v-10Z" fill="#344e41" />
      <path d="m214 155 45 26v9l-45-26Z" fill="#111e16" />
      <path d="m218 158 36 21m-33-19v6m9-1v6m9-1v6m9-1v6" stroke="#98bba9" strokeOpacity=".82" />
      <path d="m281 187 28-16v29l-28 16Z" fill="#0e2218" stroke={sorting} strokeWidth="1.5" />
      <path d="m285 190 20-12m-20 17 20-12m-20 17 20-12m-20 17 20-12" stroke={sorting} strokeOpacity=".5" />
      <path d="m280 218 31-18 6 3-32 19Z" fill={sorting} />
      <path d="m319 199 26-15 17 10-26 15Z" fill="#617960" />
      <path d="m336 209 26-15v5l-26 15Z" fill="#192b1d" />
      <path d="m319 199 17 10v5l-17-10Z" fill="#304631" />

      {/* Packaging warehouse with solar panels and shipping containers. */}
      <path d="m339 111 73-42 88 49-75 46Z" fill="#080d08" opacity=".85" />
      <path d="m338 87 80 46v36l-80-46Z" fill="#4d5846" stroke={reuse} strokeOpacity=".62" />
      <path d="m418 133 72-41v35l-72 42Z" fill="#293c2b" stroke={reuse} strokeOpacity=".62" />
      <path d="m338 87 72-41 80 46-72 41Z" fill="#6a7c62" stroke={reuse} strokeOpacity=".8" />
      <path d="m346 86 64-36 72 42-64 36Z" fill="#4f614b" stroke="#8a9b83" strokeWidth=".8" />
      <path d="m359 86 40-23 44 25-40 23Z" fill="#1d3d39" stroke="#9ab1a0" strokeWidth="1" />
      <path d="m369 80 44 25m-34-31 44 25m-34-31 44 25m-60 2 40-23m-25 31 40-23" fill="none" stroke="#8aa79c" strokeOpacity=".76" />
      <path d="m421 137 32-18v30l-32 18Z" fill="#121f15" stroke={reuse} strokeWidth="1.5" />
      <path d="m425 141 24-14m-24 19 24-14m-24 19 24-14m-24 19 24-14" stroke={reuse} strokeOpacity=".54" />
      <path d="m419 169 36-21 5 3-36 21Z" fill={reuse} />
      <path d="m467 109 14-8v8l-14 8Z" fill="#b7c093" opacity=".78" />
      <Pallet x={470} y={163} fill="#bdae7b" />
      <Pallet x={490} y={174} fill="#dbc98b" />

      <path d="m161 258 22 13m-14-18 22 13m-13-18 22 13M342 265l21-12m-13 17 21-12m-13 17 21-12" stroke="#879879" strokeOpacity=".62" />
      <path d="m44 173 13 7m-6-11 13 7m-7-11 13 7m420 16 14-8m-7 12 14-8m-7 12 14-8" stroke="#b4c1a5" strokeOpacity=".65" />
      {children}
    </svg>
  );
}
