import type { SVGProps } from "react";

/** Original dimensional broadcast/growth mark; intentionally distinct from Telegram's trademark. */
export function TelegramPromotionMark({ className = "size-10", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="tp-shell" x1="6" y1="4" x2="43" y2="45" gradientUnits="userSpaceOnUse"><stop stopColor="#39c7f2"/><stop offset=".48" stopColor="#497cf5"/><stop offset="1" stopColor="#7555d9"/></linearGradient>
        <linearGradient id="tp-plane" x1="13" y1="13" x2="34" y2="35" gradientUnits="userSpaceOnUse"><stop stopColor="white"/><stop offset="1" stopColor="#dbe8ff"/></linearGradient>
        <radialGradient id="tp-shine" cx="0" cy="0" r="1" gradientTransform="translate(14 9) rotate(46) scale(32)"><stop stopColor="white" stopOpacity=".7"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient>
        <filter id="tp-shadow" x="5" y="7" width="38" height="37" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#172554" floodOpacity=".28"/></filter>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="14" fill="#dfeaff"/>
      <rect x="4.5" y="4.5" width="39" height="39" rx="13" fill="url(#tp-shell)"/>
      <path d="M7 19C10 9 19 5 30 6c6 .5 10 3 13 7v-1A7.5 7.5 0 0 0 35.5 4.5h-23A7.5 7.5 0 0 0 5 12v18c0-4 .6-7.8 2-11Z" fill="url(#tp-shine)"/>
      <g filter="url(#tp-shadow)"><path d="m11.5 24 23.2-11.1c1.5-.8 3 .8 2.2 2.3L27 37c-.7 1.5-2.8 1.5-3.5.1l-4.1-7.2-7.5-2.4c-1.7-.5-1.9-2.7-.4-3.5Z" fill="url(#tp-plane)"/><path d="m19.4 29.9 11.4-10.7-14.2 9.8 2.8.9Z" fill="#6290ee"/><path d="m19.4 29.9 4.1 7.2 1.4-9.3-5.5 2.1Z" fill="#b8d3ff"/></g>
      <path d="M34.5 8.5c2.3.8 4 2.2 5 4.3M36 5.5c3.2 1 5.7 3.1 7 5.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity=".78"/>
      <circle cx="10" cy="38" r="2" fill="#75e4ff" opacity=".8"/>
    </svg>
  );
}
