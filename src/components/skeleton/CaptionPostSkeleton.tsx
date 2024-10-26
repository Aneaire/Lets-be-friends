import { Skeleton } from "../ui/skeleton";

const CaptionPostSkeleton = () => {
  return (
    <div className=" flex items-center w-full gap-4">
      <Skeleton className=" w-16 h-16 rounded-full bg-bgLight" />
      <Skeleton className=" flex-1 h-12 bg-bgLight" />

      <Skeleton className=" w-14 h-10 bg-bgLight " />
      <Skeleton className=" w-14 h-10 bg-bgLight " />
    </div>
  );
};

export default CaptionPostSkeleton;
