import imageCompression from "browser-image-compression";

export const resizeImageToOptimize = async (image: File) => {
  // console.log("Original File", image);
  // console.log(`Original file size: ${image.size / 1024 / 1024} MB`);

  const options = {
    maxSizeMB: 2, // Desired max size
    maxWidthOrHeight: undefined, // Maximum dimension
    useWebWorker: true, // If you want to use Web Workers
  };

  try {
    const compressedBlob = await imageCompression(image, options);

    // console.log("Compressed Blob", compressedBlob);
    // console.log(
    //   `Compressed file size: ${compressedBlob.size / 1024 / 1024} MB`
    // );

    // Extracting the original file's metadata
    const fileName = image.name; // Original filename
    const lastModified = image.lastModified; // Last modified timestamp
    const mimeType = image.type; // MIME type

    // Create a new File from the compressed Blob
    const compressedFile = new File([compressedBlob], fileName, {
      type: mimeType,
      lastModified: lastModified,
    });

    return compressedFile; // Returning a File
  } catch (error) {
    console.error("Error compressing image:", error);
  }
};
