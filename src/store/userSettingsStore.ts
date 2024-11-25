// src/store/userSettingsStore.ts
import { Models } from "appwrite";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Types
type PaginationType = "Posts" | "Reviews";

interface UserSettingsState {
  togglePagePagination: PaginationType;
  conversations: Models.Document | undefined;
}

interface UserSettingsActions {
  setTogglePagePagination: (type: PaginationType) => void;
  setConversations: (conversations: Models.Document | undefined) => void;
  resetState: () => void;
}

type UserSettingsStore = UserSettingsState & UserSettingsActions;

// Initial state
const initialState: UserSettingsState = {
  togglePagePagination: "Posts",
  conversations: undefined,
};

// Create store
const useUserSettingsStore = create<UserSettingsStore>()(
  devtools(
    (set) => ({
      // Initial state
      ...initialState,

      // Actions
      setTogglePagePagination: (type) =>
        set({ togglePagePagination: type }, false, "setTogglePagePagination"),

      setConversations: (conversations) =>
        set({ conversations }, false, "setConversations"),

      resetState: () => set(initialState, false, "resetState"),
    }),
    {
      name: "user-settings-store",
    }
  )
);

// Selectors
export const selectTogglePagePagination = (state: UserSettingsStore) =>
  state.togglePagePagination;
export const selectConversations = (state: UserSettingsStore) =>
  state.conversations;

export default useUserSettingsStore;
