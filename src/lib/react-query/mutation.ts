import useAuthStore from "@/store/userStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  acceptBooking,
  bookingConfirmation,
  bookingConfirmationValidation,
  cancelBooking,
  checkConversation,
  checkSaved,
  createAccount,
  createBooking,
  createCaptionPost,
  createPost,
  createReview,
  deletePost,
  expiredBooking,
  likePost,
  likeReview,
  ReceiptUpdateValidation,
  savePost,
  sendMessage,
  signIn,
  signOutAccount,
  unlikePost,
  unlikeReview,
  unSavePost,
  updateOwnerInfos,
  updatePost,
  updateReceipt,
  updateReview,
  updateSupport,
  verifyAccount,
} from "../appwrite/api";
import {
  createConversation,
  createPaymentLink,
  createPaymentLinkValidation,
  retrievePaymentFromPaymongo,
} from "../appwrite/functions";
import {
  ICreateAccount,
  ICreatePost,
  ICreateReview,
  IUpdatePost,
  IUpdateReview,
  IUser,
} from "../types";
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
      toast.success("Support updated");
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.USER_POSTS, user.id],
      });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      imageId,
      usedDp,
    }: {
      postId?: string;
      imageId: string;
      usedDp: boolean;
    }) => deletePost({ postId, imageId, usedDp }),

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

export const useCreateBooking = (supportId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: {
      ownerId: string;
      date: Date;
      price: number;
      ownerAccountId: string;
      note: string;
    }) => createBooking({ ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.SUPPORT, supportId],
      });
    },
  });
};

export const useBookingConfirmationValidation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: z.infer<typeof bookingConfirmationValidation>) =>
      bookingConfirmation(values).then(() => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BOOKING] });
      }),
    onSuccess: () => {
      toast.success(
        "Done! we will now review this booking for your friend to receive payment"
      );
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });
};

export const useAcceptBooking = (bookingId: string) => {
  return useMutation({
    mutationFn: () => acceptBooking(bookingId),
  });
};

export const useExpiredBooking = (bookingId: string) => {
  return useMutation({
    mutationFn: () => expiredBooking(bookingId),
  });
};

export const useCancelBooking = (bookingId: string) => {
  return useMutation({
    mutationFn: () => cancelBooking(bookingId),
  });
};

// Paymongo

export const useCreatePaymentLink = () => {
  return useMutation({
    mutationFn: (values: z.infer<typeof createPaymentLinkValidation>) =>
      createPaymentLink({ ...values }),
  });
};

export const useRetrievePaymentFromPaymongo = () => {
  return useMutation({
    mutationFn: (values: { referenceNumber: string; bookingId: string }) =>
      retrievePaymentFromPaymongo({ ...values }),
  });
};

// Receipt

export const useUpdateReceipt = () => {
  return useMutation({
    mutationFn: (values: z.infer<typeof ReceiptUpdateValidation>) =>
      updateReceipt({ ...values }),
  });
};

// Reviews

export const useCreateReview = () => {
  return useMutation({
    mutationFn: (values: ICreateReview) => createReview({ ...values }),
  });
};

export const useUpdateReview = () => {
  return useMutation({
    mutationFn: (post: IUpdateReview) => updateReview(post),
  });
};

export const useLikeReview = ({ reviewId }: { reviewId: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string }) =>
      likeReview({ reviewId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.REVIEW, reviewId],
      });
    },
  });
};

export const useUnlikeReview = ({ reviewId }: { reviewId: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ likesId }: { likesId: string }) => unlikeReview({ likesId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.REVIEW, reviewId],
      });
    },
  });
};
