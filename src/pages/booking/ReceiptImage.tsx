import FullScreenImage from "@/components/shared/FullScreenImage";
import { useGetFilePreviewWithQuality } from "@/lib/react-query/queries";

const ReceiptImage = ({ fileId }: { fileId: string }) => {
  const { data: imageUrl } = useGetFilePreviewWithQuality({
    type: "booking",
    fileId,
  });

  return (
    <FullScreenImage>
      <img
        className=" flex-1 h-40 object-cover"
        src={imageUrl}
        alt={"Receipt"}
      />
    </FullScreenImage>
  );
};

export default ReceiptImage;
