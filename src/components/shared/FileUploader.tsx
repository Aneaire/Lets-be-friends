import { icons } from "@/constants/icons";
import { convertFileToUrl } from "@/lib/utils";
import { useCallback, useState } from "react";
import { FileRejection, FileWithPath, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "../ui/button";

type FileUploaderProps = {
  fieldChange: (FILES: File[]) => void;
  mediaUrl?: string;
};

const FileUploader = ({ fieldChange, mediaUrl }: FileUploaderProps) => {
  const [fileUrl, setFileUrl] = useState<string | undefined>(mediaUrl);

  const maxSize = 20971520; // 5 MB in bytes

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const rejectedFile = fileRejections[0].file;
        if (rejectedFile.size > maxSize) {
          toast.error("File size is too large");
        } else {
          toast.error("File type is not supported");
        }
      } else {
        fieldChange(acceptedFiles);
        setFileUrl(convertFileToUrl(acceptedFiles[0]));
      }
    },
    [fieldChange]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpeg", ".jpg"],
    },
    maxSize: maxSize,
  });

  return (
    <div
      className=" flex flexCenter flex-col bg-slate-300 dark:bg-slate-900 cursor-pointer"
      {...getRootProps()}
    >
      <input {...getInputProps()} className=" cursor-pointer" />
      {fileUrl ? (
        <>
          <div className=" flex flex-1 justify-center w-full p-5 lg:p-10">
            <img
              src={fileUrl}
              alt="file-uploaded"
              className=" file_uploader-img"
            />
          </div>
          <p className="file_uploader-label">Click or drag photo to replace</p>
        </>
      ) : (
        <div className="file_uploader-box">
          {icons.fileUpload({ width: 96, height: 77 })}
          <h3 className=" font-medium text-content mt-2 mb-3">
            Drag photo here
          </h3>
          <p className=" text-content">SVG, PNG, JPG</p>
          <Button type="button" className=" bg-slate-800/70 textWhite mt-5">
            Select from device
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
