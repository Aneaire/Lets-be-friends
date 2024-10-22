import { createFileRoute } from "@tanstack/react-router";
import { config } from "../lib/appwrite/config";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="p-2">
      <h3>Welcome Home! {config.url}</h3>
    </div>
  );
}
