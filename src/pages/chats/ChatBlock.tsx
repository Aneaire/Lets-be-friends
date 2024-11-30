import ProfileAvatar from "@/components/user/ProfileAvatar";
import { formatDate } from "@/utils";

const ChatBlock = () => {
  const dateCheck = new Date(Date.now());
  const within3Days = true;
  //    item.removeExpired == null ? isWithin3Days(dateCheck) : true;

  const handleRedirect = () => {};
  return (
    <div
      onClick={() => handleRedirect()}
      className=" cursor-pointer shadow-sm shadow-white/20 flex items-center bg-bgLight w-full gap-4 px-5 py-1 rounded"
    >
      <ProfileAvatar
        className="w-12 h-12 "
        imageId={"6734b759003b11989c6a"}
        name={"Angelo"}
      />
      <div className=" text-content w-full">
        <h3 className=" font-medium">{"Angelo"}</h3>
        <div className=" flex items-center justify-between">
          {/* {within3Days ? (
            <p className=" text-xs opacity-75">
              {item.preview ? (
                item.preview
              ) : (
                <span className=" italic">start conversation</span>
              )}
            </p>
          ) : (
            <p className=" text-xs opacity-75">visit my plans!</p>
          )} */}

          {within3Days ? (
            <p className=" text-xs">{formatDate(Date.now().toString())}</p>
          ) : (
            <p className=" text-xs text-rose-500">expired</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBlock;
