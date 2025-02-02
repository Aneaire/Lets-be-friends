import LoadingIcon from "@/components/common/LoadingIcon";
import { useGetSupport } from "@/lib/react-query/queries";
import SupportText from "./SupportText";

const SupportCard = ({ supportId }: { supportId: string }) => {
  const { data: support, isLoading } = useGetSupport(supportId);

  if (isLoading)
    return (
      <span className=" w-full flex-center">
        <LoadingIcon />
      </span>
    );
  return (
    <div className=" w-full ">
      <h5 className=" bg-green-600 font-medium tracking-wider text-white text-lg text-center px-4 rounded">
        Service Fee {support?.price}
      </h5>
      <div className=" pt-8 pb-2 w-full  max-w-screen-sm mx-auto relative">
        <h1 className=" absolute -bottom-[20ox] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-accent-2 font-bold font-accent px-5 bg-bg z-10 text-xl text-center text-nowrap">
          What I Can Do for You
        </h1>
        <div className="relative border border-content rounded-md h-fit border-opacity-35 overflow-hidden">
          {/* <div className=" w-fit bg-green-600 absolute right-0 top-0 px-5">
          {support?.price}
        </div> */}
          <div className="grid grid-cols-2 gap-1 mt-2 items-center justify-center p-4">
            {support?.list.map(
              (item) =>
                item.length > 0 && <SupportText key={item} text={item} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportCard;
