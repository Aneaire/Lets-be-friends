import LoadingIcon from "@/components/common/LoadingIcon";
import ImagePost from "@/components/post/ImagePost";
import { Separator } from "@/components/ui/separator";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { stars } from "@/constants/icons";
import { IPost } from "@/lib/types";
import { formatDate } from "@/utils";
import { Link } from "@tanstack/react-router";
import ReviewPostStats from "./ReviewPostStats";

type PostCardProps = {
  posts: IPost;
  type?: "posts" | "booking";
};

const ReviewPostCard = ({ posts, type = "posts" }: PostCardProps) => {
  if (!posts) {
    return <LoadingIcon />;
  }

  return (
    <>
      {(type === "posts" ? posts.documents : [posts]).map(
        (post: IPost, index: number) => (
          <div key={post.$id + index} className="post-card">
            <div className="flex-between">
              <div className=" flex items-center gap-3">
                <Link to={`/profile/${post?.creatorId}`}>
                  <ProfileAvatar
                    imageId={post?.creator.imageId}
                    name={post?.creator.fullName}
                    quality={10}
                  />
                </Link>
                <div className="flex flex-col">
                  <p className=" font-medium lg:font-bold">
                    {post.creator.fullName}
                  </p>
                  <div className="flex gap-1 lg:gap-3 text-textLight text-xs lg:text-sm">
                    <p className="">{formatDate(post.$createdAt)}</p>
                  </div>
                </div>
              </div>
              {/* <Link
              className={`${
                user.id !== post.creatorId && "hidden"
              } cursor-pointer`}
              to={`/post/update-post/${post.$id}`}
            >
              {icons.edit(20)}
            </Link> */}
            </div>
            <Link to={`/review/${post.$id}`}>
              <div
                className={`text-xs md:text-sm leading-3 lg:text-base ${post.imageId ? "pt-2" : "pt-4"} ${
                  post.caption ? "py-2" : "py-1"
                }`}
              >
                <div className=" flex gap-2 pb-2">
                  {[1, 2, 3, 4, 5].map((starIndex) =>
                    starIndex <= post.stars ? stars.one : stars.hollow
                  )}
                </div>
                {post.caption && (
                  <span className=" whitespace-pre-line">{post.caption}</span>
                )}
              </div>
              {post?.imageId && (
                // <img
                //   className=" max-h-[800px] object-cover w-full rounded-md"
                //   src={post.imageUrl}
                //   alt=""
                //   loading="lazy"
                // />
                <ImagePost imageId={post.imageId} />
              )}
            </Link>
            <Separator className=" mb-3 opacity-75 rounded " />
            {posts && (
              <ReviewPostStats
                color={"text-content"}
                postId={post.$id}
                likes={post.likes}
              />
            )}
          </div>
        )
      )}
    </>
  );
};

export default ReviewPostCard;
