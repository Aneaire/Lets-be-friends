import { IBooking } from "@/lib/types";
import ReceiptImage from "./ReceiptImage";

const DisplayReceiptImage = ({ receipt }: { receipt: IBooking["receipt"] }) => {
  console.log("receipt", receipt);

  if (!receipt) return;

  return (
    <div className=" flex-center gap-2 mb-2 w-full flex-wrap">
      {receipt.start && <ReceiptImage fileId={receipt.start} />}
      {receipt.middle && <ReceiptImage fileId={receipt.middle} />}
      {receipt.end && <ReceiptImage fileId={receipt.end} />}
    </div>
  );
};

export default DisplayReceiptImage;
