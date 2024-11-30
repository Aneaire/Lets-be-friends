import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Models } from "appwrite";
import {
  checkLiked,
  getLatestPost,
  getOwnerInfos,
  getOwnerInfosAndSupport,
  getPost,
  getPostImage,
  getRecentInfinitePosts,
  getSupport,
  getSupportByUserId,
  getUser,
  getUserPosts,
  getUsers,
  searchPosts,
  searchUsers,
} from "../appwrite/api";
import { QUERY_KEYS } from "./queryKeys";

export const useGetOwnerInfos = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.OWNER_INFO],
    queryFn: getOwnerInfos,
  });
};

export const useGetOwnerInfosAndSupport = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.OWNER_INFO_AND_SUPPORT],
    queryFn: getOwnerInfosAndSupport,
  });
};

export const useGetSupport = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.OWNER_INFO_AND_SUPPORT + id],
    queryFn: () => getSupport(id),
    enabled: !!id,
  });
};

export const useGetSupportByUserId = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.OWNER_INFO_AND_SUPPORT + id],
    queryFn: () => getSupportByUserId(id),
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

export const useSearchUsers = (searchTerm: string = "") => {
  return useQuery({
    queryKey: [QUERY_KEYS.USERS, searchTerm],
    queryFn: () => searchUsers(searchTerm),
    enabled: !!searchTerm,
  });
};

export const useGetUsers = () => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.USERS],
    queryFn: ({ pageParam }) => getUsers({ pageParam }) as any,
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

export const useGetLatestPosts = () => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.LATEST_POST],
    queryFn: getLatestPost as any,
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

export const useGetUserPosts = ({ id }: { id?: string }) => {
  if (!id) throw Error;

  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.USER_POSTS, id],
    queryFn: ({ pageParam }) => getUserPosts({ pageParam, id }) as any,
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

export const useSearchPosts = (searchTerm: string = "") => {
  return useQuery({
    queryKey: [QUERY_KEYS.SEARCH_POSTS, searchTerm],
    queryFn: () => searchPosts(searchTerm),
    enabled: !!searchTerm,
  });
};

export const useCheckLiked = ({ postId }: { postId: string }) => {
  return useQuery({
    queryKey: [QUERY_KEYS.LIKE, postId],
    queryFn: () => checkLiked({ postId }),
  });
};

// USER IN DB
export const useGetUser = ({ id }: { id?: string }) => {
  return useQuery({
    queryKey: [QUERY_KEYS.USER, id],
    queryFn: () => getUser({ id: id! }),
    enabled: !!id,
  });
};
