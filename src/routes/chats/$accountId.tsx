import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chats/$accountId")({
  component: () => {
    return (
      <div>
        <h1>Chats</h1>
      </div>
    );
  },
});
