import { useGetPostImage } from "@/lib/react-query/queries";
import { Skeleton } from "../ui/skeleton";

const ImagePost = ({
  imageId,
  quality = 60,
}: {
  imageId: string;
  quality?: number;
}) => {
  const { data: image, isLoading } = useGetPostImage({
    imageId: imageId!,
    quality: quality,
  });

  if (!image && isLoading) return <Skeleton className=" h-52 w-full bg-bg" />;

  return (
    <img
      className=" max-h-[800px] object-cover w-full rounded-md"
      src={image}
      loading="lazy"
      draggable={false}
    />
  );
};

export default ImagePost;
