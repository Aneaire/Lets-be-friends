import { Skeleton } from "@/components/ui/skeleton";

const ChatBlockSkeleton = () => {
  return (
    <div className=" cursor-pointer shadow-sm shadow-white/20 flex items-center bg-bgLight w-full gap-4 px-5 py-1 rounded">
      <Skeleton className=" w-12 h-11 rounded-full bg-bg" />

      <div className=" text-content flex-1">
        <Skeleton className="w-[110px] h-[15px] rounded bg-bg" />
        <div className=" mt-2 flex items-center justify-between">
          <Skeleton className="w-[180px] h-[12px] rounded bg-bg" />
          <Skeleton className="w-[60px] h-[12px] rounded bg-bg " />
        </div>
      </div>
    </div>
  );
};

export default ChatBlockSkeleton;
