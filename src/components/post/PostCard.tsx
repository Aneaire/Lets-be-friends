import { icons } from "@/constants/icons";
import { IPost } from "@/lib/types";
import useAuthStore from "@/store/userStore";
import { formatDate } from "@/utils";
import { Link } from "@tanstack/react-router";
import LoadingIcon from "../common/LoadingIcon";
import { Separator } from "../ui/separator";
import ProfileAvatar from "../user/ProfileAvatar";
import ImagePost from "./ImagePost";
import PostStats from "./PostStats";

type PostCardProps = {
  posts: IPost;
};

const PostCard = ({ posts }: PostCardProps) => {
  const { user } = useAuthStore();
  if (!posts) {
    return <LoadingIcon />;
  }

  return (
    <>
      {posts.documents.map((post: IPost, index: number) => (
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
                  <p className="">{formatDate(post.$createdAt)}</p> -{" "}
                  <p>{post?.location}</p>
                </div>
              </div>
            </div>
            <Link
              className={`${
                user.id !== post.creatorId && "hidden"
              } cursor-pointer`}
              to={`/post/update-post/${post.$id}`}
            >
              {icons.edit(20)}
            </Link>
          </div>
          <Link to={`/post/${post.$id}`}>
            <div
              className={`text-xs md:text-sm leading-3 lg:text-base ${post.imageId ? "pt-2" : "pt-4"} ${
                post.caption || post.tags.length < 0 ? "py-2" : "py-1"
              }`}
            >
              {post.caption && (
                <span className=" whitespace-pre-line">{post.caption}</span>
              )}
              {post.tags.length !== 0 && (
                <ul className=" flex gap-1 mt-0.5">
                  {post.tags.map((tag: string, index: number) => (
                    <li key={tag + index} className=" text-textLight">
                      {tag.length >= 1 && `#${tag}`}
                    </li>
                  ))}
                </ul>
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
            <PostStats
              color={"text-content"}
              postId={post.$id}
              likes={post.likes}
            />
          )}
        </div>
      ))}
    </>
  );
};

export default PostCard;
