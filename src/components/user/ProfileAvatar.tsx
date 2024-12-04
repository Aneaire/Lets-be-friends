import { useGetProfileImage } from "@/lib/react-query/queries";
import { generateColorFromName } from "@/lib/utils";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Skeleton } from "../ui/skeleton";

const ProfileAvatar = ({
  imageId,
  name = "N",
  className,
  quality = 25,
  textSize = "text-xl",
  changeFallbackColor = true,
}: {
  imageId: string;
  name: string;
  quality?: number;
  className?: string;
  textSize?: string;
  changeFallbackColor?: boolean;
}) => {
  // Memoize the image query to prevent unnecessary re-renders
  const { data: image, isLoading } = useGetProfileImage({
    imageId: imageId,
    quality: quality,
  });

  // Memoize the fallback background color
  const fallbackBgColor = useMemo(() => generateColorFromName(name), [name]);

  if (!image && isLoading)
    return <Skeleton className={` ${className} bg-bg`} />;

  return (
    <Avatar className={className}>
      <AvatarImage className={`object-cover`} src={image} alt="DP" />
      <AvatarFallback
        className={`${changeFallbackColor ? fallbackBgColor : "bg-accent-2"}`}
      >
        <p className={`${textSize} text-white font-bold`}>
          {name ? name.slice(0, 1).toUpperCase() : "N"}
        </p>
      </AvatarFallback>
    </Avatar>
  );
};

export default ProfileAvatar;
