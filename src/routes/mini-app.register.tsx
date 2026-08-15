import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mini-app/register")({
  beforeLoad: () => {
    throw redirect({ to: "/mini-app/$section", params: { section: "dashboard" } });
  },
});
