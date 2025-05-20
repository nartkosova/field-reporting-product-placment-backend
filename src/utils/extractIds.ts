export const extractPublicId = (url: string): string => {
  try {
    const parts = url.split("/upload/")[1]; // get everything after /upload/
    const noExtension = parts.split(".")[0]; // remove .jpg, .png, etc.
    return noExtension; // e.g., podravka/65-krem-juhe-20250519211539641
  } catch (e) {
    console.error("Invalid Cloudinary URL:", url);
    return "";
  }
};
