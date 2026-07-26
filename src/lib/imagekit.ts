import ImageKit from "imagekit";

// ImageKit server-side client (used in API routes only)
// Credentials are loaded from .env:
//   IMAGEKIT_PUBLIC_KEY
//   IMAGEKIT_PRIVATE_KEY
//   NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? "",
});

export type ImageKitUploadResult = {
  url: string;
  fileId: string;
  filePath: string;
};

/**
 * Upload a file to ImageKit and return the URL, fileId, and filePath.
 *
 * @param file    - The raw file buffer/bytes
 * @param fileName - A unique name for the file in ImageKit storage
 * @param folder  - Optional folder path in ImageKit (defaults to "/labdocs")
 * @returns       - The full ImageKit URL, fileId, and filePath
 */
export async function uploadToImageKit(
  file: Buffer | string,
  fileName: string,
  folder: string = "/labdocs"
): Promise<ImageKitUploadResult> {
  const result = await imagekit.upload({
    file,
    fileName,
    folder,
    useUniqueFileName: true,
  });

  return {
    url: result.url,
    fileId: result.fileId,
    filePath: result.filePath,
  };
}

/**
 * Delete a file from ImageKit by its fileId.
 * Used when an admin removes an image so we don't accumulate orphaned files.
 *
 * @param fileId - The ImageKit fileId (obtained from the upload response)
 */
export async function deleteFromImageKit(fileId: string): Promise<void> {
  await imagekit.deleteFile(fileId);
}
