import type { SVGProps } from "react";

/** Original geometric broadcast mark; intentionally distinct from Telegram's trademark. */
export function TelegramPromotionMark({ className = "size-9", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}>
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <path d="M10.5 20.8 27.8 12c1.3-.7 2.7.6 2.1 2L23 30.5c-.5 1.3-2.3 1.4-3 .2l-3.2-5.3-5.5-1.7c-1.4-.4-1.6-2.2-.8-2.9Z" fill="white" fillOpacity=".96" />
      <path d="m16.8 25.4 8.1-8.1-10.1 6.9 2 1.2Z" fill="currentColor" fillOpacity=".5" />
      <path d="M29.5 7.8c1.4.7 2.6 1.8 3.4 3.2M31.8 5c2.1 1 3.9 2.7 5 4.8" stroke="white" strokeWidth="1.7" strokeLinecap="round" opacity=".82" />
    </svg>
  );
}
