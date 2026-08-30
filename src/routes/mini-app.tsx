import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/mini-app")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: Outlet,
});
