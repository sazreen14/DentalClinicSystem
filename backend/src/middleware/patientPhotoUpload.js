import path from "node:path";
import multer from "multer";
import { AppError } from "../utils/AppError.js";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (_request, file, done) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimes.has(file.mimetype)) {
      done(new AppError("Choose a JPG, PNG, or WEBP image.", 422, "INVALID_PROFILE_PHOTO_TYPE"));
      return;
    }
    done(null, true);
  },
}).single("photo");

export function profilePhotoUpload(request, response, next) {
  upload(request, response, (error) => {
    if (error) {
      if (error instanceof AppError) return next(error);
      const message = error.code === "LIMIT_FILE_SIZE" ? "Profile photo must be 2 MB or smaller." : "Invalid profile photo upload.";
      return next(new AppError(message, 422, "INVALID_PROFILE_PHOTO_UPLOAD"));
    }
    if (!request.file?.buffer?.length) return next(new AppError("Choose a profile photo to upload.", 422, "PROFILE_PHOTO_REQUIRED"));
    next();
  });
}

export const patientPhotoUpload = profilePhotoUpload;
