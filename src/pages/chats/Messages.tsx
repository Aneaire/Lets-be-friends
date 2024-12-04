import ProfileAvatar from "@/components/user/ProfileAvatar";
import { client, config } from "@/lib/appwrite/config";
import { useGetMessages } from "@/lib/react-query/queries";
import { IMessage, IUserImageAndName } from "@/lib/types";
import useAuthStore from "@/store/userStore";
import { Dispatch, SetStateAction, useEffect, useMemo } from "react";

const Messages = ({
  conversationId,
  userInfo,
  messages,
  setMessages,
}: {
  conversationId: string;
  userInfo: IUserImageAndName;
  messages: IMessage[];
  setMessages: Dispatch<SetStateAction<IMessage[]>>;
}) => {
  const user = useAuthStore((state) => state.user);

  // Fetch messages with React Query
  const { data: fetchedMessages, isLoading } = useGetMessages({
    collectionId: conversationId,
  });

  // Memoize current message IDs for faster duplicate filtering
  const currentMessageIds = useMemo(
    () => new Set(messages.map((msg) => msg.$id)),
    [messages]
  );

  // Add fetched messages to the state, ensuring no duplicates
  useEffect(() => {
    if (!fetchedMessages) return;

    const newMessages = fetchedMessages.pages
      .flatMap((page) => page.documents)
      .filter((msg) => !currentMessageIds.has(msg.$id));

    if (newMessages.length > 0) {
      setMessages((prevMessages) => [...prevMessages, ...newMessages]);
    }
  }, [fetchedMessages, currentMessageIds, setMessages]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = client.subscribe(
      [`databases.${config.chatDb}.collections.${conversationId}.documents`],
      (event: any) => {
        if (!currentMessageIds.has(event.payload.$id)) {
          setMessages((prevMessages) => [event.payload, ...prevMessages]);
        }
      }
    );

    return () => unsubscribe();
  }, [conversationId, currentMessageIds, setMessages]);

  // Prepare rendered messages
  const renderedMessages = useMemo(() => {
    return [...messages].reverse().map((message: IMessage) => {
      const isCurrentUser = message.sender === user.id;
      const sender = isCurrentUser
        ? { fullName: "You", username: user.username, imageId: user.imageId }
        : userInfo;

      return (
        <div
          key={message.$id}
          className={`flex items-end gap-2.5 ${
            isCurrentUser ? "flex-row-reverse" : ""
          }`}
        >
          <ProfileAvatar
            imageId={sender.imageId}
            name={sender.fullName}
            className="w-8 h-8"
          />
          <div
            className={`max-w-[75%] p-3 rounded-2xl ${
              isCurrentUser
                ? "bg-accent-2 text-primary-foreground"
                : "bg-accent-1"
            }`}
          >
            <p className="text-sm font-medium">{message.body}</p>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>
                {new Date(message.$createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      );
    });
  }, [messages, user, userInfo]);

  // Show loading state if messages are still fetching
  if (isLoading) {
    return <div>Loading messages...</div>;
  }

  return <div className="flex flex-col gap-2">{renderedMessages}</div>;
};

export default Messages;
