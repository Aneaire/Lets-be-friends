import { IMessage } from "@/lib/types";
import { create } from "zustand";

// Type for the messages store state
type MessagesState = {
  messagesByConversation: Record<string, IMessage[]>;
  addMessage: (conversationId: string, message: IMessage) => void;
  addMessages: (conversationId: string, messages: IMessage[]) => void;
  clearConversationMessages: (conversationId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  getMessages: (conversationId: string) => IMessage[];
};

const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByConversation: {},

  addMessage: (conversationId, message) =>
    set((state) => {
      const existingMessages =
        state.messagesByConversation[conversationId] || [];
      if (existingMessages.some((msg) => msg.$id === message.$id)) return state;

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existingMessages, message].sort(
            (a, b) =>
              new Date(a.$createdAt).getTime() -
              new Date(b.$createdAt).getTime()
          ),
        },
      };
    }),

  addMessages: (conversationId, messages) =>
    set((state) => {
      const existingMessages =
        state.messagesByConversation[conversationId] || [];
      const uniqueMessages = messages.filter(
        (msg) =>
          !existingMessages.some((existingMsg) => existingMsg.$id === msg.$id)
      );

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existingMessages, ...uniqueMessages].sort(
            (a, b) =>
              new Date(a.$createdAt).getTime() -
              new Date(b.$createdAt).getTime()
          ),
        },
      };
    }),

  clearConversationMessages: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...remainingConversations } =
        state.messagesByConversation;
      return { messagesByConversation: remainingConversations };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]:
          state.messagesByConversation[conversationId]?.filter(
            (msg) => msg.$id !== messageId
          ) || [],
      },
    })),

  getMessages: (conversationId) => {
    const state = get();
    return state.messagesByConversation[conversationId] || [];
  },
}));

export default useMessagesStore;
