const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config({ path: "../.env" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface File {
  originalname: string;
}

interface RequestBody {
  customName?: string;
}

interface RequestFile {
  body: RequestBody;
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req: any, file: any) => {
    const customName = req.body?.customName;
    const originalName = file.originalname.split(".")[0];
    const baseName = String(customName || originalName);

    // Strip anything that could escape the "podravka" folder or otherwise
    // control the remote path (slashes, dots, separators).
    const public_id =
      baseName
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .replace(/\.+/g, ".")
        .replace(/^[.-]+/, "")
        .slice(0, 100)
        .toLowerCase() || `upload-${Date.now()}`;

    return {
      folder: "podravka",
      public_id,
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      transformation: [
        {
          quality: "auto:good",
          fetch_format: "auto",
          width: 900,
          crop: "limit",
        },
      ],
    };
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG and WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
});

module.exports = { upload, cloudinary };
