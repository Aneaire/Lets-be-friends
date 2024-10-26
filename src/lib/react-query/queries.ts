import { useQuery } from "@tanstack/react-query";
import { getOwnerInfos, getProfileImage } from "../appwrite/api";
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
    queryFn: () => getProfileImage(imageId, quality),
    enabled: !!imageId,
  });
};
