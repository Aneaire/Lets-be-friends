import { useGetPostImage } from "@/lib/react-query/queries";
import { Skeleton } from "../ui/skeleton";

const ImagePost = ({
  imageId,
  quality = 50,
  card = "post-card",
  className,
}: {
  imageId: string;
  quality?: number;
  card?: "post-card" | "explore-card" | "profile-card";
  className?: string;
}) => {
  const { data: image, isLoading } = useGetPostImage({
    imageId: imageId!,
    quality: quality,
  });

  if (!image && isLoading) return <Skeleton className=" h-52 w-full bg-bg" />;

  if (card === "explore-card") {
    return (
      <img className="h-full w-full object-cover" src={image} loading="lazy" />
    );
  }

  if (card === "profile-card") {
    return (
      <img
        className=" w-[100px] aspect-square object-cover rounded-full"
        src={image}
        loading="lazy"
      />
    );
  }

  return (
    <img
      className={` max-h-[800px] object-cover w-full rounded-md ${className}`}
      src={image}
      loading="lazy"
      draggable={false}
    />
  );
};

export default ImagePost;
