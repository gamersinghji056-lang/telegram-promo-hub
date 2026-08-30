const SITE_ORIGIN = "https://tg.mark8bot.com";
export function publicPageHead(title: string, description: string, path: string) {
  const url = `${SITE_ORIGIN}${path === "/" ? "" : path}`;
  return { meta: [{ title: `${title} | MARK8BOT` },{ name: "description", content: description },{ property: "og:title", content: `${title} | MARK8BOT` },{ property: "og:description", content: description },{ property: "og:type", content: "website" },{ property: "og:url", content: url },{ name: "twitter:card", content: "summary_large_image" },{ name: "twitter:title", content: `${title} | MARK8BOT` },{ name: "twitter:description", content: description }], links: [{ rel: "canonical", href: url }] };
}
