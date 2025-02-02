import { MapPostCardSkeleton } from "@/components/skeleton/PostCardSkeleton";
import { useGetUserReviews } from "@/lib/react-query/queries";
import ReviewPostCard from "./ReviewPostCard";

const ReviewPosts = ({ id }: { id: string }) => {
  const { data: post, isPending } = useGetUserReviews({ id: id });
  if (isPending) return <MapPostCardSkeleton />;

  return post?.pages[0].documents.length > 0 ? (
    post?.pages.map((p: any, index: number) => (
      <ReviewPostCard key={index} posts={p} />
    ))
  ) : (
    <p className=" w-full text-center text-textLight max-w-screen-sm">
      No current review
    </p>
  );
};

export default ReviewPosts;
