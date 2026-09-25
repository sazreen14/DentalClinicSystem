import{Router}from'express';import{authenticateToken}from'../middleware/authenticateToken.js';import{requireRole}from'../middleware/requireRole.js';import{validateRequest}from'../middleware/validateRequest.js';import{asyncHandler}from'../utils/asyncHandler.js';import * as c from'../controllers/identityController.js';import * as v from'../validators/identityValidators.js';
import path from 'node:path';
import { patientPhotoUpload, profilePhotoUpload } from '../middleware/patientPhotoUpload.js';
import { photoDirectory } from '../services/patientPhotoService.js';
import { AppError } from '../utils/AppError.js';
const router=Router();
const patient=Router();patient.use(authenticateToken,requireRole('Patient'));patient.get('/',asyncHandler(c.patientMe));patient.patch('/',v.patientPatchRules,validateRequest,asyncHandler(c.patchPatientMe));patient.post('/photo',patientPhotoUpload,asyncHandler(c.uploadPatientPhoto));
const doctor=Router();doctor.use(authenticateToken,requireRole('Doctor'));doctor.get('/',asyncHandler(c.doctorMe));doctor.patch('/',v.doctorPatchRules,validateRequest,asyncHandler(c.patchDoctorMe));doctor.post('/photo',profilePhotoUpload,asyncHandler(c.uploadDoctorPhoto));
const admin=Router();admin.use(authenticateToken,requireRole('Admin'));admin.get('/patients',asyncHandler(c.adminPatients));admin.get('/patients/:patientId',v.patientIdRules,validateRequest,asyncHandler(c.adminPatient));admin.patch('/patients/:patientId',v.patientIdRules,v.patientPatchRules,validateRequest,asyncHandler(c.patchAdminPatient));admin.patch('/patients/:patientId/status',v.patientIdRules,v.statusRules,validateRequest,asyncHandler(c.patchPatientStatus));admin.get('/users',asyncHandler(c.adminUsers));admin.get('/users/:userId',v.userIdRules,validateRequest,asyncHandler(c.adminUser));admin.patch('/users/:userId',v.userIdRules,v.userPatchRules,validateRequest,asyncHandler(c.patchAdminUser));admin.patch('/users/:userId/status',v.userIdRules,v.statusRules,validateRequest,asyncHandler(c.patchUserStatus));
router.use('/patient/profile',patient);router.use('/doctor/profile',doctor);router.use('/admin/identity',admin);
router.get('/public/profile-photos/:filename',(request,response,next)=>{
  const filename=request.params.filename;
  if(!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(filename))return next(new AppError('Profile photo not found.',404,'PROFILE_PHOTO_NOT_FOUND'));
  response.set('Cross-Origin-Resource-Policy','cross-origin');
  response.set('X-Content-Type-Options','nosniff');
  response.sendFile(path.join(photoDirectory,filename),{dotfiles:'deny'},error=>{if(error&&!response.headersSent)next(new AppError('Profile photo not found.',404,'PROFILE_PHOTO_NOT_FOUND'));});
});
export default router;
