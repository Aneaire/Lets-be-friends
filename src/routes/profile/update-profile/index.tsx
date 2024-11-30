import PostForm from "@/components/post/form/PostForm";
import { icons } from "@/constants/icons";
import EditProfileInfos from "@/pages/profile/EditProfileInfos";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/profile/update-profile/")({
  validateSearch: (
    search: Record<string, unknown>
  ): { toggleSupport?: boolean } => {
    return {
      toggleSupport: search.toggleSupport as boolean,
    };
  },
  component: () => {
    const { toggleSupport } = Route.useSearch();
    const [toggleLink, setToggleLink] = useState(!toggleSupport);

    useEffect(() => {
      toggleSupport === true &&
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
    }, [toggleSupport]);
    return (
      <div className="max-w-5xl mx-auto  flex flex-1 text-content overflow-x-hidden">
        <div className=" common-container">
          <div className=" flex-start gap-3 justify-start w-full">
            {icons.galleryAdd(36)}
            <h2 className=" heading flex gap-5 items-center justify-center">
              {toggleLink ? "Edit Profile Info's" : "Update Profile Picture"}
              <button onClick={() => setToggleLink(!toggleLink)}>
                {icons.arrowRight(32)}
              </button>
            </h2>
          </div>
          {!toggleLink ? <EditProfileInfos /> : <PostForm action="Profile" />}
        </div>
      </div>
    );
  },
});
