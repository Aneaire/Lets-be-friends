import { icons } from "@/constants/icons";
import {
  useCheckConversation,
  useCreateConversation,
} from "@/lib/react-query/mutation";
import { IConversation } from "@/lib/types";
import useAuthStore from "@/store/userStore";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "../ui/button";

const CreateConvo = ({ userAccountId }: { userAccountId: string }) => {
  const user = useAuthStore.getState().user;
  const navigate = useNavigate();

  const { mutateAsync: checkConversation } = useCheckConversation();
  const { mutateAsync: createConversation } = useCreateConversation();

  const handleMessageButton = () => {
    checkConversation({
      accountId1: user.accountId,
      accountId2: userAccountId,
    }).then((data) => {
      if (data) {
        navigate({ to: `/chats/${data.conversationId}` });
      } else {
        createConversation({
          accountId1: user.accountId,
          accountId2: userAccountId,
        }).then((data) => {
          console.log(data);
          toast.success("Conversation created");
          const parsedData: IConversation = JSON.parse(data!);
          navigate({ to: `/chats/${parsedData.conversationId}` });
        });
      }
    });
  };

  return (
    <Button
      onClick={handleMessageButton}
      className=" flex gap-6 text-dark-1 dark:textWhite px-4 py-2 mtext-sm bg-accent-1/10 rounded-md w-fit"
    >
      <span className=" hidden md:block">Message</span> {icons.chat(20)}
    </Button>
  );
};

export default CreateConvo;
