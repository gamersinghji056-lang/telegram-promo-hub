import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mini-app")({
  beforeLoad: () => { throw redirect({ to: "/mini-app/$section", params: { section: "dashboard" } }); },
});