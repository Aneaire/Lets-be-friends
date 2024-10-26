import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { config } from "../lib/appwrite/config";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  return (
    <div className="p-2">
      <h3>Welcome Home! {config.url}</h3>
    </div>
  );
}
