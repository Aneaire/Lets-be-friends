import { useGetUserPosts } from "@/lib/react-query/queries";
import { MapPostCardSkeleton } from "../skeleton/PostCardSkeleton";
import PostCard from "./PostCard";

const UserPosts = ({ id }: { id: string }) => {
  const { data: post, isPending } = useGetUserPosts({ id: id });
  if (isPending) return <MapPostCardSkeleton />;

  return post?.pages[0].documents.length > 0 ? (
    post?.pages.map((p: any, index: number) => (
      <PostCard key={index} posts={p} />
    ))
  ) : (
    <p className=" w-full text-center text-textLight max-w-screen-sm">
      No current post
    </p>
  );
};

export default UserPosts;
