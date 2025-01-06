import { icons } from "@/constants/icons";
import ReviewForm from "@/pages/review/ReviewForm";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/review/create-review/$userId")({
  component: () => (
    <div className=" flex flex-1 text-content overflow-x-hidden ">
      <div className=" common-container">
        <div className=" max-w-5xl flex-start gap-3 justify-start w-full">
          {icons.galleryAdd(36)}
          <h2 className=" heading">Create Review</h2>
        </div>
        <ReviewForm action="Create" />
      </div>
    </div>
  ),
});
