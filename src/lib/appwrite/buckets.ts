// handling buckets

import { defaultToast } from "@/utils/defaultToast";
import { resizeImageToOptimize } from "@/utils/handlingImage";
import { ID } from "appwrite";
import { config, storage } from "./config";
import { userToAny } from "./permissions";

export async function uploadFile(file: File, accountId?: string) {
  try {
    const image = await resizeImageToOptimize(file);

    if (!image) throw Error;

    const uploadedFile = await storage.createFile(
      config.postBucket,
      ID.unique(),
      image,
      accountId ? userToAny(accountId) : undefined
    );

    return uploadedFile;
  } catch (error: any) {
    defaultToast.SWW(error.message);
  }
}

export async function deleteFile(fileId: string) {
  try {
    await storage.deleteFile(config.postBucket, fileId);

    return { status: "ok" };
  } catch (error) {
    defaultToast.SWW;
  }
}

export function getFilePreview(fileId: string) {
  try {
    // Retrieve the file URL without resizing or cropping
    const fileUrl = storage.getFilePreview(
      config.postBucket,
      fileId,
      undefined, // width
      undefined, // height
      undefined, // gravity
      100 // quality
    );

    if (!fileUrl) throw Error;

    return fileUrl;
  } catch (error) {
    defaultToast.SWW;
  }
}
