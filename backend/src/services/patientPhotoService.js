import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../config/database.js";
import * as model from "../models/identityModel.js";
import { AppError } from "../utils/AppError.js";
import { PHOTO_MAX_BYTES } from "../middleware/patientPhotoUpload.js";
import { myDoctor, myPatient } from "./identityService.js";

export const photoDirectory = fileURLToPath(new URL("../../uploads/profile-photos/", import.meta.url));
const extensionForMime = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export function detectedPhotoMime(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9) return "image/jpeg";
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.subarray(12, 16).toString("ascii") === "IHDR") return "image/png";
  if (buffer.length >= 16 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(buffer.subarray(12, 16).toString("ascii"))) return "image/webp";
  return null;
}

async function saveProfilePhoto(userId, file, {findProfile,updatePhoto,serialize,missingMessage,missingCode}) {
  if (!file?.buffer?.length || file.buffer.length > PHOTO_MAX_BYTES) throw new AppError("Profile photo must be 2 MB or smaller.", 422, "INVALID_PROFILE_PHOTO_SIZE");
  const mime = detectedPhotoMime(file.buffer);
  if (!mime || mime !== file.mimetype || path.extname(file.originalname).toLowerCase() !== extensionForMime[mime] && !(mime === "image/jpeg" && path.extname(file.originalname).toLowerCase() === ".jpeg")) {
    throw new AppError("The file must be a valid JPG, PNG, or WEBP image.", 422, "INVALID_PROFILE_PHOTO_TYPE");
  }
  const profile = await findProfile(db, userId);
  if (!profile) throw new AppError(missingMessage, 404, missingCode);
  const key = `${randomBytes(24).toString("hex")}${extensionForMime[mime]}`;
  await mkdir(photoDirectory, { recursive: true });
  await writeFile(path.join(photoDirectory, key), file.buffer, { flag: "wx" });
  try {
    await updatePhoto(db, userId, key);
  } catch (error) {
    await unlink(path.join(photoDirectory, key)).catch(() => {});
    throw error;
  }
  if (profile.profile_photo_key) await unlink(path.join(photoDirectory, profile.profile_photo_key)).catch(() => {});
  return serialize(userId);
}

export const saveMyPhoto=(userId,file)=>saveProfilePhoto(userId,file,{findProfile:model.patientByUser,updatePhoto:model.updatePatientPhoto,serialize:myPatient,missingMessage:'Patient profile is unavailable.',missingCode:'PATIENT_PROFILE_NOT_FOUND'});
export const saveMyDoctorPhoto=(userId,file)=>saveProfilePhoto(userId,file,{findProfile:model.doctorByUser,updatePhoto:model.updateDoctorPhoto,serialize:myDoctor,missingMessage:'Doctor profile is unavailable.',missingCode:'DOCTOR_PROFILE_NOT_FOUND'});
