import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { icons } from "@/constants/icons";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Refactored Types based on provided document
export type IMessage = {
  body: string;
  read: boolean;
  type: "text" | "image";
  sender: string;
  imageUrl?: string;
  imageId?: string;
  $id: string;
  $createdAt: string;
};

export type IMessageUserData = {
  fullName: string;
  username: string;
  imageId: string;
};

const dummyMessages: IMessage[] = [
  {
    $id: "msg1",
    $createdAt: new Date().toISOString(),
    body: "Hey there! How are you doing today?",
    sender: "user123",
    read: false,
    type: "text",
  },
  {
    $id: "msg2",
    $createdAt: new Date().toISOString(),
    body: "Just checking in. What's new?",
    sender: "user456",
    read: false,
    type: "text",
  },
];

const dummyUsers: Record<string, IMessageUserData> = {
  user123: {
    fullName: "John Doe",
    username: "johndoe",
    imageId: "profile1",
  },
  user456: {
    fullName: "Jane Smith",
    username: "janesmith",
    imageId: "profile2",
  },
};

const MessagesCopy = () => {
  const [messages, setMessages] = useState<IMessage[]>(dummyMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll management
  useEffect(() => {
    if (!isScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isScrolledUp]);

  // Scroll tracking
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsScrolledUp(!isNearBottom);
    }
  };

  // Message sending handler
  const handleSendMessage = () => {
    if (inputMessage.trim() === "") return;

    const newMessage: IMessage = {
      $id: `msg_${Date.now()}`,
      $createdAt: new Date().toISOString(),
      body: inputMessage,
      sender: "current_user",
      read: false,
      type: "text",
    };

    // Optimistic update
    setMessages((prev) => [...prev, newMessage]);
    setInputMessage("");

    // TODO: Replace with actual message sending logic
    // Example:
    // sendMessage(newMessage)
    //   .then(() => {
    //     // Update message status or remove optimistic message
    //   })
    //   .catch(() => {
    //     // Handle error, possibly remove the optimistic message
    //   });
  };

  // Scroll to bottom button
  const ScrollToBottomButton = () => (
    <Button
      variant="outline"
      size="icon"
      className={`
        fixed bottom-20 right-4 z-50 
        ${isScrolledUp ? "opacity-100" : "opacity-0"}
        transition-all duration-300
      `}
      onClick={() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setIsScrolledUp(false);
      }}
    >
      <ChevronDownIcon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-background">
      {/* Chat Header */}
      <div className="sticky top-0 z-10 shadow-sm p-4 flex items-center bg-bgLight/80 backdrop-blur-[3px]">
        <ProfileAvatar
          imageId="conversation_avatar"
          name="Group Chat"
          className="mr-3"
        />
        <div>
          <h2 className="font-semibold">Group Chat</h2>
          <p className="text-xs text-muted-foreground">Active now</p>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-grow overflow-y-auto p-4 space-y-4 scroll-smooth bg-bgLight/40"
      >
        {messages.map((message) => {
          const isCurrentUser = message.sender === "current_user";
          const sender = !isCurrentUser
            ? dummyUsers[message.sender]
            : { fullName: "You", username: "you", imageId: "current_user" };

          return (
            <div
              key={message.$id}
              className={`
                flex items-end gap-2.5
                ${isCurrentUser ? "flex-row-reverse" : ""}
              `}
            >
              <ProfileAvatar
                imageId={sender.imageId}
                name={sender.fullName}
                className="w-8 h-8"
              />
              <div
                className={`
                  max-w-[75%] p-3 rounded-2xl
                  ${
                    isCurrentUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }
                `}
              >
                <p className="text-sm">{message.body}</p>
                <div className="text-xs text-muted-foreground mt-1 flex justify-between">
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
        })}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton />

      {/* Message Input Area */}
      <div className="sticky bottom-0 bg-bgLight p-4 border-t border-gray-700 dark:border-gray-400 h-fit">
        <div className="flex items-center gap-2 h-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className=" pl-0 pr-2 md:px-4">
                  {icons.galleryAdd(25)}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach files</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <SmileIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Emoji</TooltipContent>
            </Tooltip>
          </TooltipProvider> */}

          <Textarea
            placeholder="Type your message..."
            className="flex-grow min-h-[20px] max-h-28 resize-none text-dark-1"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          {/* <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                >
                  <MicIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice message</TooltipContent>
            </Tooltip>
          </TooltipProvider> */}

          <Button
            onClick={handleSendMessage}
            disabled={inputMessage.trim() === ""}
            className="bg-accent-2 textWhite"
          >
            {icons.send(25)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MessagesCopy;
