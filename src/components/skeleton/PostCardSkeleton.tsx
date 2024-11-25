import { Skeleton } from "../ui/skeleton";

export const MapPostCardSkeleton = () => {
  return Array.from({ length: 10 }, (_, index) => (
    <PostCardSkeleton key={index} />
  ));
};

export const PostCardSkeleton = () => {
  return (
    <div className="post-card">
      <div className="flex-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full bg-bg" />{" "}
          {/* User profile image */}
          <div className="flex flex-col">
            <span className="flex gap-3">
              <Skeleton className="w-[120px] h-[16px] bg-bg rounded-sm" />
              <Skeleton className="w-[80px] h-[16px] bg-bg rounded-sm" />
            </span>

            {/* User name */}
            <div className="flex items-center gap-1 lg:gap-3 mt-2 text-textLight text-xs lg:text-sm">
              <Skeleton className="w-[30px] h-[10px] bg-bg" />{" "}
              <Skeleton className="w-[30px] h-[10px] bg-bg" />{" "}
              {/* Date and location */}
            </div>
          </div>
        </div>
        <Skeleton className=" w-[30px] h-[30px] bg-bg" /> {/* Edit icon */}
      </div>
      <div className="text-sm lg:text-base py-3">
        <Skeleton className="w-full h-[14px] bg-bg" /> {/* Post caption */}
        <Skeleton className="w-1/2 h-[14px] bg-bg mt-2" /> {/* Post caption */}
      </div>
      <Skeleton className="max-h-[800px] h-[350px] bg-bg object-cover w-full rounded-md" />{" "}
      {/* Post image */}
      <span className="flex items-center justify-between mt-2">
        <Skeleton className="w-[50px] h-[25px] bg-bg rounded-lg" />{" "}
        {/* Post stats */}
        <Skeleton className="w-[50px] h-[25px] bg-bg rounded-lg" />{" "}
        {/* Post stats */}
      </span>
    </div>
  );
};
