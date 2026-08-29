import type { SVGProps } from "react";

export type ProductIconName =
  | "home" | "campaigns" | "audience" | "analytics" | "settings"
  | "direct" | "groups" | "search-users" | "search-groups" | "approved"
  | "joined" | "categories" | "growth" | "billing" | "referral" | "sessions";

const tones: Record<ProductIconName, [string, string, string]> = {
  home: ["#4f7cff", "#7658e8", "#dbe7ff"], campaigns: ["#ff7a59", "#ff4d8d", "#ffe1d9"],
  audience: ["#27b9d7", "#5b7cfa", "#d6f7ff"], analytics: ["#6b63e8", "#9a5bea", "#e9e4ff"],
  settings: ["#64748b", "#7c8aa5", "#e8edf5"], direct: ["#4f7cff", "#27b9d7", "#dbeafe"],
  groups: ["#8b5cf6", "#ec4899", "#f3e8ff"], "search-users": ["#22b8a7", "#4f7cff", "#d7fff7"],
  "search-groups": ["#14b8a6", "#38bdf8", "#d7faf5"], approved: ["#22b573", "#45c49a", "#d8f8e8"],
  joined: ["#3b82f6", "#6366f1", "#dbeafe"], categories: ["#f59e0b", "#fb7185", "#fff0c7"],
  growth: ["#16a677", "#38bdf8", "#d8f8e8"], billing: ["#4f7cff", "#8b5cf6", "#e4e7ff"],
  referral: ["#ec4899", "#8b5cf6", "#fce7f3"], sessions: ["#06b6d4", "#4f7cff", "#d6f7ff"],
};

function Glyph({ name }: { name: ProductIconName }) {
  if (name === "home") return <path d="M14 26V15.8l10-8 10 8V26a3 3 0 0 1-3 3h-4.5v-7h-5v7H17a3 3 0 0 1-3-3Z" fill="white" />;
  if (name === "campaigns") return <><path d="M12 17.5 27 11v17L12 21.5v-4Z" fill="white"/><path d="m16 22 2.5 8h5l-3-6.6L16 22Z" fill="white" opacity=".78"/><path d="M30 15c2 1.4 2 7.6 0 9" stroke="white" strokeWidth="2.4" strokeLinecap="round"/></>;
  if (["audience","groups","search-groups"].includes(name)) return <><circle cx="24" cy="15" r="5" fill="white"/><circle cx="14.5" cy="18" r="3.5" fill="white" opacity=".76"/><circle cx="33.5" cy="18" r="3.5" fill="white" opacity=".76"/><path d="M14 31c.8-6 4-9 10-9s9.2 3 10 9H14Z" fill="white"/><path d="M8.5 29c.4-4 2.4-6.2 6-6.5-1.2 1.7-2 3.8-2.3 6.5H8.5Zm27.3 0c-.3-2.7-1.1-4.8-2.3-6.5 3.6.3 5.6 2.5 6 6.5h-3.7Z" fill="white" opacity=".72"/></>;
  if (name === "analytics" || name === "growth") return <><rect x="12" y="23" width="5" height="8" rx="2" fill="white" opacity=".72"/><rect x="21" y="18" width="5" height="13" rx="2" fill="white" opacity=".86"/><rect x="30" y="12" width="5" height="19" rx="2" fill="white"/><path d="m12 17 8-5 6 2 8-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></>;
  if (name === "settings") return <><path d="M24 10.5 27 12l3.1-.6 2.5 2.5-.6 3.1 1.5 3-1.5 3 .6 3.1-2.5 2.5L27 28l-3 1.5-3-1.5-3.1.6-2.5-2.5.6-3.1-1.5-3 1.5-3-.6-3.1 2.5-2.5 3.1.6 3-1.5Z" fill="white"/><circle cx="24" cy="20" r="4" fill="currentColor" opacity=".7"/></>;
  if (name === "direct" || name === "search-users") return <><circle cx="18" cy="16" r="5" fill="white"/><path d="M9.5 31c.8-7 3.7-10 8.5-10s7.7 3 8.5 10h-17Z" fill="white"/><path d="m26 19 11-5-4.5 11-2-3-3 1 1-3-2.5-1Z" fill="white" opacity=".86"/></>;
  if (name === "approved") return <><circle cx="22" cy="20" r="11" fill="white" opacity=".95"/><path d="m16.5 20 3.6 3.6 7.5-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="m32 11 1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4L32 11Z" fill="white"/></>;
  if (name === "joined" || name === "sessions") return <><rect x="12" y="8" width="24" height="28" rx="6" fill="white"/><rect x="15" y="12" width="18" height="16" rx="3" fill="currentColor" opacity=".16"/><circle cx="24" cy="32" r="1.5" fill="currentColor" opacity=".7"/><path d="m19 20 3 3 6-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></>;
  if (name === "categories") return <><path d="M10 15a3 3 0 0 1 3-3h8l3 3h11a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V15Z" fill="white"/><path d="M15 21h18M15 26h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55"/></>;
  if (name === "billing") return <><rect x="9" y="12" width="30" height="23" rx="5" fill="white"/><path d="M9 18h30" stroke="currentColor" strokeWidth="3" opacity=".35"/><circle cx="31" cy="29" r="7" fill="#ffd65a"/><path d="M31 25v8m2-6.5h-3a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3h-3" stroke="#8a5b00" strokeWidth="1.4" strokeLinecap="round"/></>;
  if (name === "referral") return <><rect x="11" y="18" width="26" height="18" rx="3" fill="white"/><path d="M9 15h30v7H9z" fill="white" opacity=".8"/><path d="M24 15v21" stroke="currentColor" strokeWidth="3" opacity=".32"/><path d="M24 15c-7-1-8-8-3-8 3 0 3 5 3 8Zm0 0c7-1 8-8 3-8-3 0-3 5-3 8Z" fill="white"/></>;
  return null;
}

export function ProductIcon({ name, className = "size-12", ...props }: { name: ProductIconName } & SVGProps<SVGSVGElement>) {
  const [from, to, glow] = tones[name];
  const id = `pi-${name.replaceAll("-", "")}`;
  return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
    <defs><linearGradient id={id} x1="7" y1="5" x2="41" y2="43" gradientUnits="userSpaceOnUse"><stop stopColor={from}/><stop offset="1" stopColor={to}/></linearGradient><radialGradient id={`${id}-shine`} cx="0" cy="0" r="1" gradientTransform="translate(15 10) rotate(48) scale(28)"><stop stopColor="white" stopOpacity=".55"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient></defs>
    <rect x="4" y="4" width="40" height="40" rx="13" fill={glow}/><rect x="5.5" y="5.5" width="37" height="37" rx="12" fill={`url(#${id})`}/><rect x="6" y="6" width="36" height="19" rx="11" fill={`url(#${id}-shine)`}/><g style={{color:to}}><Glyph name={name}/></g><path d="M12 39c8 3 21 2 27-6" stroke="white" strokeOpacity=".18" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
