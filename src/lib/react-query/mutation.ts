import useAuthStore from "@/store/userStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  checkConversation,
  checkSaved,
  createAccount,
  createCaptionPost,
  createPost,
  deletePost,
  likePost,
  savePost,
  sendMessage,
  signIn,
  signOutAccount,
  unlikePost,
  unSavePost,
  updateOwnerInfos,
  updatePost,
  updateSupport,
  verifyAccount,
} from "../appwrite/api";
import { createConversation } from "../appwrite/functions";
import { ICreateAccount, ICreatePost, IUpdatePost, IUser } from "../types";
import { QUERY_KEYS } from "./queryKeys";

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

export const useUpdateOwnerinfos = () => {
  return useMutation({
    mutationFn: (
      values: { userId: string } & Pick<IUser, "bio" | "bday" | "gender">
    ) => updateOwnerInfos({ ...values }),
    onSuccess: () => {
      toast.success("Infos updated");
    },
  });
};

export const useUpdateSupport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: {
      supports: string[];
      supportId: string | null;
      price: number;
    }) => updateSupport({ ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.OWNER_INFO_AND_SUPPORT],
      });
    },
  });
};

// Handling posts
export const useCreatePost = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore.getState();
  return useMutation({
    mutationFn: (post: ICreatePost) => createPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.RECENT_POST],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.USER_POSTS, user.id],
      });
    },
  });
};

export const useUpdatePost = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore.getState();
  return useMutation({
    mutationFn: (post: IUpdatePost) => updatePost(post),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.USER_POSTS, user.id],
      });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, imageId }: { postId?: string; imageId: string }) =>
      deletePost({ postId, imageId }),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.RECENT_POST],
      });
    },
  });
};

export const useCreateCaptionPost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caption, creator }: { caption: string; creator: string }) =>
      createCaptionPost({ caption, creator }),
    onSuccess: () => {
      toast.success("Post created successfully");
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RECENT_POST] });
    },
  });
};

export const useLikePost = ({ postId }: { postId: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) => likePost({ postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.RECENT_POST, postId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.POST, postId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.USER_POSTS, postId],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.POST, postId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LIKE, postId] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.LATEST_POST, postId],
      });
    },
  });
};

export const useUnlikePost = ({ postId }: { postId: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userLikesId }: { userLikesId: string }) =>
      unlikePost({ userLikesId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.RECENT_POST, postId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.POST, postId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.USER_POSTS, postId],
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.POST, postId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LIKE, postId] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.LATEST_POST, postId],
      });
    },
  });
};

export const useCheckSaved = () => {
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) => checkSaved({ postId }),
  });
};

export const useSavePost = () => {
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) => savePost({ postId }),
  });
};

export const useUnSavePost = () => {
  return useMutation({
    mutationFn: ({ userSavedId }: { userSavedId: string }) =>
      unSavePost({ userSavedId }),
  });
};

// Chats

export const useCreateConversation = () => {
  return useMutation({
    mutationFn: (values: {
      accountId1: string;
      accountId2: string;
      userId1: string;
      userId2: string;
    }) => createConversation({ ...values }),
  });
};

export const useCheckConversation = () => {
  return useMutation({
    mutationFn: (values: { userId1: string; userId2: string }) =>
      checkConversation({
        userId1: values.userId1,
        userId2: values.userId2,
      }),
  });
};

export const useSendMessage = () => {
  return useMutation({
    mutationFn: (values: {
      conversation: string;
      collectionId: string;
      body: string;
    }) => sendMessage({ ...values }),
  });
};
