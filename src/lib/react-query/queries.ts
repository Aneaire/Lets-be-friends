import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Models } from "appwrite";
import {
  checkLiked,
  getOwnerInfos,
  getPost,
  getPostImage,
  getRecentInfinitePosts,
} from "../appwrite/api";
import { QUERY_KEYS } from "./queryKeys";

export const useGetOwnerInfos = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.OWNER_INFO],
    queryFn: getOwnerInfos,
  });
};

export const useGetProfileImage = ({
  imageId,
  quality,
}: {
  imageId: string;
  quality: number;
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.PROFILE_PICTURE, imageId + quality],
    queryFn: () => getPostImage({ imageId, quality }),
    enabled: !!imageId,
  });
};

// Posts

export const useGetPost = (postId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.POST, postId],
    queryFn: () => getPost({ id: postId }),
    enabled: !!postId,
  });
};

export const useGetPostImage = ({
  imageId,
  quality,
}: {
  imageId: string;
  quality: number;
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.POST + imageId + quality],
    queryFn: () => getPostImage({ imageId, quality }),
  });
};

export const useGetRecentInfinitePosts = () => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.RECENT_POST],
    queryFn: getRecentInfinitePosts as any,
    getNextPageParam: (lastPage: Models.Document) => {
      if (lastPage && lastPage.documents.length === 0) {
        return null;
      }
      const lastId = lastPage?.documents[lastPage?.documents.length - 1].$id;
      return lastId;
    },
    initialPageParam: null,
  });
};

export const useCheckLiked = ({ postId }: { postId: string }) => {
  return useQuery({
    queryKey: [QUERY_KEYS.LIKE, postId],
    queryFn: () => checkLiked({ postId }),
  });
};
