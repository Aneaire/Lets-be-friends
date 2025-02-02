import FullScreenImage from "@/components/shared/FullScreenImage";
import NotFound from "@/components/shared/NotFound";
import { Separator } from "@/components/ui/separator";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { stars } from "@/constants/icons";
import { getReview } from "@/lib/appwrite/api";
import ReviewPostStats from "@/pages/review/ReviewPostStats";
import { formatDate } from "@/utils";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/review/$reviewId")({
  loader: async ({ params }) => {
    const { reviewId } = params; // Extract reviewId from params
    const review = await getReview({ id: reviewId }); // Fetch review data directly

    return { review: review };
  },
  component: () => {
    const { review: post } = Route.useLoaderData();
    // const { isPending: isDeleting } = useDeletePost();

    if (!post) return <NotFound />;

    return (
      <div className={`post_details-container `}>
        <div className=" post_details-card">
          {!!post?.image && (
            <FullScreenImage>
              <img
                src={post?.image}
                alt="creator"
                className="post_details-img object-contain h-fit"
              />
            </FullScreenImage>
          )}
          <div
            className={`post_details-info gap-2 ${
              !!post?.imageUrl && "rounded-t-[30px]"
            }`}
          >
            <div className="flex-between gap-6 w-full">
              <Link
                className=" flex items-center gap-3"
                to={`/profile/${post?.creatorId}`}
              >
                <ProfileAvatar
                  imageId={post?.creator?.imageId!}
                  name={post?.creator?.fullName!}
                />
                <div className="flex gap-1 flex-col">
                  <p className=" text-content font-medium lg:font-bold">
                    {post?.creator?.fullName}
                  </p>
                  <div className="flex gap-1 lg:gap-3 text-textLight text-xs lg:text-sm">
                    <p className="">{formatDate(post?.$createdAt)}</p> -
                    <p>{post?.location}</p>
                  </div>
                </div>
              </Link>
            </div>
            <hr className="border w-full border-dark-1/20" />
            <div className={` text-content text-sm lg:text-base space-y-1 `}>
              <div className=" flex gap-2 pb-2">
                {[1, 2, 3, 4, 5].map((starIndex) =>
                  starIndex <= post.stars ? stars.one : stars.hollow
                )}
              </div>
              <span className={`whitespace-pre-line pb-1`}>
                {post?.caption}
              </span>
            </div>
            <div className=" mt-auto w-full">
              {post?.image && <Separator className=" mb-2" />}
              {post && (
                <ReviewPostStats
                  color="text-content"
                  postId={post?.$id}
                  likes={post?.likes!}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
});
