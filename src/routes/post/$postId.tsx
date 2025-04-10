import { DeletePostBtn } from "@/components/post/DeletePost";
import PostStats from "@/components/post/PostStats";
import FullScreenImage from "@/components/shared/FullScreenImage";
import PostDetailsSkeleton from "@/components/skeleton/PostDetailsSkeleton";
import { Separator } from "@/components/ui/separator";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { icons } from "@/constants/icons";
import { useDeletePost } from "@/lib/react-query/mutation";
import { useGetPost } from "@/lib/react-query/queries";
import useAuthStore from "@/store/userStore";
import { formatDate } from "@/utils";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/post/$postId")({
  component: () => {
    const { postId } = useParams({ strict: false });
    const user = useAuthStore((state) => state.user);
    const { data: post, isLoading } = useGetPost(postId ? postId : "");
    const { isPending: isDeleting } = useDeletePost(postId!);

    const whoOwnerIs = user?.accountId == post?.creator.accountId;
    const creatorAccess = whoOwnerIs ? (
      <div className={` flex-end flex-1 gap-1`}>
        <Link to={`/post/update-post/${post?.$id}`}>{icons.edit(24)}</Link>
        <DeletePostBtn
          imageId={post.imageId!}
          postId={post?.$id}
          usedDp={post.usedDp}
        />
      </div>
    ) : (
      <></>
    );
    return (
      <div className={`${isDeleting && "opacity-30"} post_details-container `}>
        {isLoading ? (
          <>
            <PostDetailsSkeleton />
          </>
        ) : (
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
              className={`post_details-info ${
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
                    name={post?.creator.fullName!}
                  />
                  <div className="flex gap-1 flex-col">
                    <p className=" text-content font-medium lg:font-bold">
                      {post?.creator.fullName}
                    </p>
                    <div className="flex gap-1 lg:gap-3 text-textLight text-xs lg:text-sm">
                      <p className="">{formatDate(post?.$createdAt)}</p> -
                      <p>{post?.location}</p>
                    </div>
                  </div>
                </Link>

                {creatorAccess}
              </div>
              <hr className="border w-full border-dark-1/20" />
              {}
              <div className={` text-content text-sm lg:text-base space-y-2 `}>
                <span className={`whitespace-pre-line py-1`}>
                  {post?.caption}
                </span>
                <ul className=" flex gap-1">
                  {post?.tags &&
                    post?.tags.map((tag: string) => (
                      <li key={tag} className=" text-textLight">
                        {tag.length >= 1 && `#${tag}`}
                      </li>
                    ))}
                </ul>
              </div>
              <div className=" mt-auto w-full">
                {post?.image && <Separator className=" mb-2" />}
                {post && (
                  <PostStats
                    color="text-content"
                    postId={post?.$id}
                    likes={post?.likes}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
});
