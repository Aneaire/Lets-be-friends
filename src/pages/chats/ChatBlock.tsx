import ProfileAvatar from "@/components/user/ProfileAvatar";
import { useGetUserImageAndName } from "@/lib/react-query/queries";
import { IConversation } from "@/lib/types";
import { extractOtherId } from "@/lib/utils";
import { formatDate } from "@/utils";
import { useNavigate } from "@tanstack/react-router";
import ChatBlockSkeleton from "./ChatBlockSkeleton";

const ChatBlock = ({
  conversation,
  ownerId,
}: {
  conversation: IConversation;
  ownerId: string;
}) => {
  const userId = extractOtherId({
    mixedIds: conversation.userIds,
    knownId: ownerId,
  });
  const { data: user, isLoading } = useGetUserImageAndName(userId);

  const navigate = useNavigate({ from: "/chats" });
  const handleRedirect = () => {
    navigate({
      to: `/chats/${conversation.$id}`,
      search: { userId, conversation: conversation.$id },
    });
  };

  if (!user || isLoading) return <ChatBlockSkeleton />;

  return (
    <div
      onClick={() => handleRedirect()}
      className=" cursor-pointer shadow-sm shadow-white/20 flex items-center bg-bgLight w-full gap-4 px-5 py-1 rounded"
    >
      <ProfileAvatar
        className="w-12 h-12 "
        imageId={user.imageId}
        name={user.fullName}
      />
      <div className=" text-content w-full">
        <h3 className=" font-medium">{user.fullName}</h3>
        <div className=" flex items-center justify-between">
          <p className=" text-xs opacity-75">
            {conversation.preview == null
              ? "Have an chat"
              : conversation.preview}
          </p>

          <p className=" text-xs">{formatDate(conversation.$updatedAt)}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatBlock;
