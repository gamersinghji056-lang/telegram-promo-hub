import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/mini-app")({
  component: Outlet,
});