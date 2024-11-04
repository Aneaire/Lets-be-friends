// src/contexts/AuthContext.tsx
import { useGetOwnerInfos } from "@/lib/react-query/queries";
import useAuthStore from "@/store/userStore";
import { ReactNode, useEffect } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: ownerInfos, isLoading, error, refetch } = useGetOwnerInfos();
  const { login, setLoading, setError } = useAuthStore();

  useEffect(() => {
    // Store the refetch function in Zustand
    refetch;
  }, [refetch]);

  useEffect(() => {
    setLoading(isLoading);
    if (ownerInfos) {
      login({
        id: ownerInfos.$id || "",
        accountId: ownerInfos.accountId || "",
        fullName: ownerInfos.fullName || "",
        username: ownerInfos.username || "",
        imageId: ownerInfos.imageId || "",
        image: ownerInfos.image || "",
        email: ownerInfos.email || "",
      });
    }

    if (error) {
      setError(true);
      // toast("Make sure you are logged in");
    }
  }, [ownerInfos, error]);

  return children;
};

// Custom hook that replaces useAuthContext
export const useAuth = () => {
  const store = useAuthStore();

  if (!store) {
    throw new Error("useAuth must be used within a component tree");
  }

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    setUser: store.setUser,
  };
};
