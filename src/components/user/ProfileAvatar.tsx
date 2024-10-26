import { useGetProfileImage } from "@/lib/react-query/queries";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Skeleton } from "../ui/skeleton";

const ProfileAvatar = ({
  imageId,
  name = "N",
  className,
  quality = 25,
}: {
  imageId: string;
  name: string;
  quality?: number;
  className?: string;
}) => {
  const { data: image, isLoading } = useGetProfileImage({
    imageId: imageId,
    quality: quality,
  });
  if (!image && isLoading)
    return <Skeleton className={` ${className} bg-bg`} />;
  return (
    <Avatar className={className}>
      <AvatarImage className={`object-cover `} src={image} alt="DP" />
      <AvatarFallback className={`bg-accent-2 `}>
        <p className=" text-xl textWhite font-bold">
          {name ? name.slice(0, 1) : "N"}
        </p>
      </AvatarFallback>
    </Avatar>
  );
};

export default ProfileAvatar;
