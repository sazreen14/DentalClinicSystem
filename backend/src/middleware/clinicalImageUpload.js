import multer from 'multer';
import {AppError} from '../utils/AppError.js';
import {env} from '../config/env.js';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:env.clinicalImages.maxBytes,files:1,fields:2,parts:4},fileFilter:(_q,file,done)=>done(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))}).single('image');
export function clinicalImageUpload(request,response,next){upload(request,response,error=>{if(error){const message=error.code==='LIMIT_FILE_SIZE'?'Clinical image exceeds the 8 MiB limit.':'Invalid clinical image upload.';return next(new AppError(message,422,'INVALID_CLINICAL_IMAGE_UPLOAD'));}if(!request.file)return next(new AppError('One clinical image is required.',422,'CLINICAL_IMAGE_REQUIRED'));next();});}
