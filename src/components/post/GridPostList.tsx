import useAuthStore from "@/store/userStore";
import { Link } from "@tanstack/react-router";
import { Models } from "appwrite";
import LoadingIcon from "../common/LoadingIcon";
import ProfileAvatar from "../user/ProfileAvatar";
import ImagePost from "./ImagePost";
import PostStats from "./PostStats";

type GridPostListProps = {
  posts?: Models.Document[];
  showUser?: boolean;
  showStats?: boolean;
};
const GridPostList = ({
  posts,
  showUser = true,
  showStats = true,
}: GridPostListProps) => {
  const user = useAuthStore((state) => state.user);
  if (!posts) return <LoadingIcon size={"1"} />;
  return (
    <>
      {posts?.map((post) =>
        post.imageId ? (
          <li key={post.$id} className="relative min-w-80 h-80">
            <Link className=" grid-post_link" to={`../post/${post.$id}`}>
              {/* <img
                className="h-full w-full object-cover"
                src={post.imageUrl}
                alt=""
              /> */}
              <ImagePost card="explore-card" imageId={post.imageId} />
            </Link>
            <div className="grid-post_user">
              {showUser && (
                <div className=" flex items-center justify-start gap-2 flex-1">
                  <ProfileAvatar
                    imageId={post.creator.imageId}
                    name={post.creator.fullName}
                  />
                  <p className=" textWhite line-clamp-1">
                    {post.creator.fullName}
                  </p>
                </div>
              )}

              {showStats && (
                <PostStats
                  color="textWhite"
                  postId={post.$id}
                  likes={post.likes}
                />
              )}
            </div>
          </li>
        ) : null
      )}
    </>
  );
};

export default GridPostList;
