import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Types
interface User {
  id: string;
  accountId: string;
  email: string;
  fullName: string;
  username: string;
  imageId: string;
  image: string;
}

interface AuthState {
  user: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: boolean;
}

interface AuthActions {
  setUser: (user: User) => void;
  clearUser: () => void;
  login: (user: User) => void;
  logout: () => void;
  setError: (error: boolean) => void;
  setLoading: (isLoading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

// Initial state
const initialUserState: User = {
  id: "",
  accountId: "",
  email: "",
  fullName: "",
  username: "",
  imageId: "",
  image: "",
};

const initialState: AuthState = {
  user: initialUserState,
  isAuthenticated: false,
  isLoading: false,
  error: false,
};

// Create store with middleware
const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        // State
        ...initialState,

        // Actions
        setUser: (user: User) =>
          set({ user, isAuthenticated: true, error: false }, false, "setUser"),

        clearUser: () =>
          set(
            { user: initialUserState, isAuthenticated: false },
            false,
            "clearUser"
          ),

        login: (user: User) =>
          set(
            {
              user,
              isAuthenticated: true,
              isLoading: false,
              error: false,
            },
            false,
            "login"
          ),

        logout: () =>
          set(
            {
              ...initialState,
            },
            false,
            "logout"
          ),

        setError: (error: boolean) => set({ error }, false, "setError"),
        setLoading: (isLoading: boolean) =>
          set({ isLoading }, false, "setLoading"),
      }),
      {
        name: "auth-storage",
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);

// Selectors
export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) =>
  state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectError = (state: AuthStore) => state.error;

export default useAuthStore;
