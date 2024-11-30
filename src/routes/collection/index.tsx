import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/collection/")({
  component: () => {
    return (
      <div>
        <h1>Collection</h1>
      </div>
    );
  },
});
