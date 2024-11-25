import CreateConvo from "@/components/chat/CreateConvo";
import LoadingScreen from "@/components/common/LoadingScreen";
import ImagePost from "@/components/post/ImagePost";
import PostCaption from "@/components/post/PostCaption";
import UserPosts from "@/components/post/UserPost";
import { Button } from "@/components/ui/button";
import { icons } from "@/constants/icons";
import { useGetUser } from "@/lib/react-query/queries";
import useUserSettingsStore from "@/store/userSettingsStore";
import useAuthStore from "@/store/userStore";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$userId")({
  component: () => {
    const { userId } = useParams({ strict: false });
    const owner = useAuthStore.getState().user;
    const { data: user, isLoading } = useGetUser({ id: userId });

    const togglePagePagination = useUserSettingsStore(
      (state) => state.togglePagePagination
    );
    const setTogglePagePagination =
      useUserSettingsStore.getState().setTogglePagePagination;

    const isOwnerProfile = owner.id === userId;

    if (!userId && !user && isLoading) return <LoadingScreen />;

    return (
      <div className="w-full max-w-section mx-auto px-2 md:px-5 lg:px-14">
        {isOwnerProfile ? (
          <div className=" w-ful flex justify-between mt-2 text-sm">
            <Link
              to={`/profile/plans/${userId}`}
              className=" flex textWhite gap-2 px-4 py-2 md:text-sm bg-accent-2 rounded-md w-fit"
            >
              <span className=" hidden md:block">View Plans</span>{" "}
              {icons.plans(20)}
            </Link>
            <Link
              to={`/profile/update-profile`}
              className=" flex gap-3 text-content px-4 py-2 mtext-sm rounded-md w-fit"
            >
              <span className=" hidden md:block">Edit Profile </span>
              {icons.editWhite(22)}
            </Link>
          </div>
        ) : (
          <>
            <CreateConvo id={userId!} />
          </>
        )}

        <div className=" flex flex-col  lg:flex-row lg:gap-3 items-center justify-center mt-10">
          {user?.imageId ? (
            <ImagePost
              card="profile-card"
              imageId={user?.imageId}
              quality={50}
            />
          ) : (
            <img
              className=" w-[130px] aspect-square object-cover rounded-full"
              src="/images/profile-placeholder.svg"
            />
          )}
          <div className=" text-center lg:text-start text-content">
            <h3 className="heading-2 lg:text-2xl lg:font-semibold tracking-wider font-bold mt-2 lg:mt-0">
              {user?.fullName}
            </h3>
            <h2 className=" text-textLight text-sm">@{user?.username}</h2>
            <p className=" whitespace-pre-line text-sm italic font-light mt-1">
              "{user?.bio}"
            </p>
          </div>
        </div>
        {isOwnerProfile && (
          <div className=" mt-4 w-full  max-w-screen-sm mx-auto ">
            <PostCaption />{" "}
          </div>
        )}
        <div className=" flex justify-end max-w-screen-sm mx-auto ">
          <Button
            onClick={() =>
              togglePagePagination == "Posts"
                ? setTogglePagePagination("Reviews")
                : setTogglePagePagination("Posts")
            }
            className=" text-accent-2 text-sm"
          >
            {togglePagePagination == "Posts" ? "Reviews" : "Posts"} {">>"}
          </Button>
        </div>

        <div className="flex flex-col flex-center gap-5 mb-10 text-content">
          <UserPosts id={userId!} />
        </div>
      </div>
    );
  },
});
