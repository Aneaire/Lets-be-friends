import { icons } from "@/constants/icons";
import {
  useCheckConversation,
  useCreateConversation,
} from "@/lib/react-query/mutation";
import { IConversation } from "@/lib/types";
import useAuthStore from "@/store/userStore";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import LoadingIcon from "../common/LoadingIcon";
import { Button } from "../ui/button";

const CreateConvo = ({
  userAccountId,
  userId,
}: {
  userAccountId: string;
  userId: string;
}) => {
  const user = useAuthStore.getState().user;
  const navigate = useNavigate();

  const { mutateAsync: checkConversation, isPending: checking } =
    useCheckConversation();
  const { mutateAsync: createConversation, isPending: creating } =
    useCreateConversation();

  const handleMessageButton = () => {
    checkConversation({
      userId1: user.id,
      userId2: userId,
    }).then((data) => {
      if (data) {
        navigate({
          to: `/chats/${data.$id}`,
          search: { userId, conversation: data.$id },
        });
      } else {
        createConversation({
          accountId1: user.accountId,
          accountId2: userAccountId,
          userId1: user.id,
          userId2: userId,
        }).then((data) => {
          toast.success("Conversation created");
          const parsedData: IConversation = JSON.parse(data!);
          navigate({
            to: `/chats/${parsedData.$id}`,
            search: { userId: userId, conversation: parsedData.$id },
          });
        });
      }
    });
  };

  if (checking || creating)
    return (
      <Button
        disabled={checking || creating}
        className=" flex gap-6 text-dark-1 dark:textWhite px-4 py-2 mtext-sm bg-accent-1/10 rounded-md w-fit"
      >
        <LoadingIcon />
      </Button>
    );

  return (
    <Button
      disabled={checking || creating}
      onClick={handleMessageButton}
      className=" flex gap-6 text-dark-1 dark:textWhite px-4 py-2 mtext-sm bg-accent-1/10 rounded-md w-fit"
    >
      <span className=" hidden md:block">Message</span> {icons.chat(20)}
    </Button>
  );
};

export default CreateConvo;
