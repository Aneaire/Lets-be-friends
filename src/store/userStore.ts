import { useGetOwnerInfos } from "@/lib/react-query/queries";
import { toast } from "sonner";
import { create } from "zustand";

// Define the User type
interface User {
  id: string;
  accountId: string;
  fullName: string;
  username: string;
  imageId: string;
  image: string;
}

// Define the store state interface
interface AuthState {
  user: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  setIsAuthenticated: (value: boolean) => void;
  initializeAuth: () => Promise<void>;
}

// Create the store
export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: "",
    accountId: "",
    fullName: "Angelo Santiago",
    username: "",
    imageId: "",
    image: "",
  },
  isAuthenticated: false,
  isLoading: false,

  setUser: (user: User) => set({ user }),
  setIsAuthenticated: (value: boolean) => set({ isAuthenticated: value }),

  // Initialize auth state
  initializeAuth: async () => {
    try {
      set({ isLoading: true });
      const { data: ownerInfos, error } = await useGetOwnerInfos();

      if (error) {
        toast.error("Something went wrong");
        return;
      }

      if (ownerInfos) {
        set({
          isAuthenticated: true,
          user: {
            id: ownerInfos.$id || "",
            accountId: ownerInfos.accountId || "",
            fullName: ownerInfos.fullName || "",
            username: ownerInfos.username || "",
            imageId: ownerInfos.imageId || "",
            image: ownerInfos.image || "",
          },
        });
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Optional: Create selector hooks for specific state values
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useIsLoading = () => useAuthStore((state) => state.isLoading);
