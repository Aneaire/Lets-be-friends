import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$userId")({
  component: () => <div>Hello /profile/$userId!</div>,
});
