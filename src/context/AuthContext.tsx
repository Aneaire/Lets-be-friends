// src/contexts/AuthContext.tsx

import { useGetOwnerInfos } from "@/lib/react-query/queries";
import { useNavigate } from "@tanstack/react-router";
import React, { createContext, ReactNode, useContext, useState } from "react";
import { toast } from "sonner";

// 1. Define the User type
interface User {
  id: string;
  accountId: string;
  fullName: string;
  username: string;
  imageId: string;
  image: string;
}

// 2. Create the AuthContext type
interface AuthContextType {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
}

// 3. Create the context with default values
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 4. Create a provider component to wrap your app
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { data: ownerInfos, isLoading, error } = useGetOwnerInfos();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User>({
    id: "",
    accountId: "",
    fullName: "Angelo Santiago",
    username: "",
    imageId: "",
    image: "",
  });

  React.useEffect(() => {
    if (ownerInfos) {
      setIsAuthenticated(true);
      setUser({
        id: ownerInfos.$id || "",
        accountId: ownerInfos.accountId || "",
        fullName: ownerInfos.fullName || "",
        username: ownerInfos.username || "",
        imageId: ownerInfos.imageId || "",
        image: ownerInfos.image || "",
      });
    }

    if (error) {
      toast.error("Something went wrong");
    }
  }, [ownerInfos, error]);

  return (
    <AuthContext.Provider
      value={{ user, setUser, isAuthenticated, setIsAuthenticated, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 5. Create a custom hook to use the context
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useUser must be used within a AuthProvider");
  }
  return context;
};
