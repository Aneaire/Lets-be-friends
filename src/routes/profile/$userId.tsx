import { Button } from "@/components/ui/button";
import { createFileRoute, useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$userId")({
  component: () => {
    const { history } = useRouter();
    return (
      <div className=" flex flex-col">
        <p>Hello /profile/$userId!</p>
        <Button onClick={() => history.back()}>Back</Button>
      </div>
    );
  },
});
