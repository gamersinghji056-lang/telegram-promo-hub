import { createFileRoute, redirect } from "@tanstack/react-router";
import { TELEGRAM_PROMOTION_WORKSPACE_PATH } from "@/lib/promotion-platform";

export const Route = createFileRoute("/promotion/app")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `${TELEGRAM_PROMOTION_WORKSPACE_PATH}${location.searchStr}${location.hash}`,
    });
  },
  head: () => ({
    meta: [
      { title: "Telegram Promotion Web App" },
      { name: "description", content: "Open the standalone Telegram Promotion web application with direct customer login or Telegram session handoff." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PromotionAppAlias,
});

function PromotionAppAlias() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Opening Telegram Promotion Web App...</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your web login or Telegram session handoff will use the same Promotion workspace.
        </p>
        <a className="mt-5 inline-flex text-sm font-medium text-primary" href={TELEGRAM_PROMOTION_WORKSPACE_PATH}>
          Continue to the Web App
        </a>
      </div>
    </main>
  );
}
