import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ProfileAvatar from "@/components/user/ProfileAvatar";
import { icons } from "@/constants/icons";
import { useSendMessage } from "@/lib/react-query/mutation";
import { useGetUserImageAndName } from "@/lib/react-query/queries";
import { IMessage } from "@/lib/types";
import Messages from "@/pages/chats/Messages";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Params = { userId: string; conversation: string };

export const Route = createFileRoute("/chats/$conversation")({
  validateSearch: (search: Record<string, unknown>): Params => ({
    userId: search.userId as string,
    conversation: search.conversation as string,
  }),

  component: () => {
    const { userId, conversation } = Route.useSearch();
    const { conversation: collectionId } = useParams({ strict: false });
    const { data: userInfo, isLoading } = useGetUserImageAndName(userId);
    const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();
    const [inputMessage, setInputMessage] = useState("");
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const [messages, setMessages] = useState<IMessage[]>([]);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Scroll management
    const scrollToBottom = useCallback(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setIsScrolledUp(false);
    }, []);

    useEffect(() => {
      if (!isScrolledUp) scrollToBottom();
    }, [messages, isScrolledUp, scrollToBottom]);

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current || {};
      setIsScrolledUp(scrollHeight! - scrollTop! - clientHeight! >= 100);
    };

    const handleSendMessage = async () => {
      if (inputMessage.trim() === "") return;

      try {
        const message = await sendMessage({
          body: inputMessage,
          collectionId: collectionId!,
          conversation,
        });
        if (message) {
          setInputMessage("");
          scrollToBottom();
        }
      } catch (error: any) {
        toast.error(error.message);
      }
    };

    const renderSkeletonHeader = useMemo(
      () => (
        <div className="sticky top-0 z-10 shadow-sm p-4 flex items-center bg-bgLight/80 backdrop-blur-[3px]">
          <Skeleton className="w-12 h-12 mr-3 rounded-full bg-bg" />
          <div>
            <Skeleton className="w-28 h-6 rounded bg-bg" />
            <Skeleton className="w-16 h-4 mt-2 rounded bg-bg" />
          </div>
        </div>
      ),
      []
    );

    const ScrollToBottomButton = useMemo(
      () => (
        <Button
          variant="outline"
          size="icon"
          className={`fixed bottom-20 right-4 z-50 transition-opacity duration-300 ${isScrolledUp ? "opacity-100" : "opacity-0"}`}
          onClick={scrollToBottom}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      ),
      [isScrolledUp, scrollToBottom]
    );

    if (isLoading || !userInfo) {
      return (
        <div className="page-container pt-5 min-h-screen">
          <div className="w-full flex flex-col h-screen max-w-4xl mx-auto bg-background">
            {renderSkeletonHeader}
          </div>
        </div>
      );
    }

    return (
      <div className="page-container pt-5 min-h-screen">
        <div className="w-full flex flex-col h-screen max-w-4xl mx-auto bg-background">
          <div className="sticky top-0 z-10 shadow-sm p-4 flex items-center bg-bgLight/80 backdrop-blur-[3px]">
            <ProfileAvatar
              imageId={userInfo.imageId}
              name={userInfo.fullName}
              className="mr-3"
            />
            <div>
              <h2 className="font-semibold">{userInfo.fullName}</h2>
              <p className="text-xs text-muted-foreground">Active now</p>
            </div>
          </div>

          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-grow overflow-y-auto p-4 space-y-4 scroll-smooth bg-bgLight/40"
          >
            <Messages
              messages={messages}
              setMessages={setMessages}
              conversationId={collectionId!}
              userInfo={userInfo}
            />
            <div ref={bottomRef} />
          </div>

          {ScrollToBottomButton}

          <div className="sticky bottom-0 bg-bgLight p-4 border-t border-gray-700 dark:border-gray-400 h-fit">
            <div className="flex items-center gap-2 h-full">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="pl-0 pr-2 md:px-4">
                      {icons.galleryAdd(25)}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach files</TooltipContent>
                </Tooltip>
              </TooltipProvider>

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

              <Button
                onClick={handleSendMessage}
                disabled={inputMessage.trim() === ""}
                className="bg-accent-2 text-white"
              >
                {icons.send(25)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
