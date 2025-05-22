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
    const baseName = customName || originalName;
    const public_id = baseName.replace(/\s+/g, "-").toLowerCase();

    return {
      folder: "podravka",
      public_id,
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      transformation: [
        {
          quality: "auto:eco",
          fetch_format: "auto",
          width: 800,
          crop: "limit",
        },
      ],
    };
  },
});

const upload = multer({ storage });

module.exports = { upload, cloudinary };
