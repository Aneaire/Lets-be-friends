import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAccount,
  signIn,
  signOutAccount,
  verifyAccount,
} from "../appwrite/api";
import { ICreateAccount } from "../types";

// Handling accounts
export const useCreateAccount = () => {
  return useMutation({
    mutationFn: (values: ICreateAccount) => createAccount(values),
    onSuccess: () => {
      toast.success("Please check your email to verify your account");
    },
  });
};

export const useSignIn = () => {
  return useMutation({
    mutationFn: (values: { email: string; password: string }) =>
      signIn(values.email, values.password),
  });
};

export const useSignOutAccount = () => {
  return useMutation({
    mutationFn: signOutAccount,
  });
};

export const useVerifyAccount = () => {
  return useMutation({
    mutationFn: ({
      accountId,
      secret,
    }: {
      accountId: string;
      secret: string;
    }) => verifyAccount({ accountId, secret }),
    onError: () => {
      toast.error("Something went wrong");
    },
  });
};
