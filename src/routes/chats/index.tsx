import { useGetConversations } from "@/lib/react-query/queries";
import { IConversation } from "@/lib/types";
import ChatBlock from "@/pages/chats/ChatBlock";
import ChatBlockSkeleton from "@/pages/chats/ChatBlockSkeleton";
import useAuthStore from "@/store/userStore";
import autoAnimate from "@formkit/auto-animate";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/chats/")({
  component: () => {
    const user = useAuthStore.getState().user;
    const parent = useRef(null);
    const { data: conversations, isLoading } = useGetConversations();

    const DisplayList = () => (
      <>
        {conversations?.pages.map((data) =>
          data.documents.map((conversation: IConversation) => (
            <ChatBlock
              ownerId={user.id}
              key={conversation.$id}
              conversation={conversation}
            />
          ))
        )}
      </>
    );

    useEffect(() => {
      parent.current && autoAnimate(parent.current);
    }, [parent]);

    return (
      <div className="flex flex-1 text-content">
        <div className="home-container">
          <div className="home-posts">
            <div className=" w-full flex justify-between">
              <h2 className="  font-bold text-xl md:text-2xl tracking-wide text-left">
                Chats
              </h2>
            </div>

            {/* Contents */}

            <section
              ref={parent}
              className=" w-full space-y-2 mx-auto max-w-2xl"
            >
              {isLoading ? (
                [...Array(20)].map((_, i) => <ChatBlockSkeleton key={i} />)
              ) : (
                <DisplayList />
              )}
            </section>
          </div>
        </div>
      </div>
    );
  },
});
