import { Router } from 'express'; import * as c from '../controllers/doctorAppointmentController.js'; import { authenticateToken } from '../middleware/authenticateToken.js'; import { requireRole } from '../middleware/requireRole.js'; import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { blockTodayRules, unblockTodayRules } from '../validators/doctorTodayAvailabilityValidators.js';
const r=Router();r.use(authenticateToken,requireRole('Doctor'));r.get('/appointments',asyncHandler(c.list));r.get('/schedule',asyncHandler(c.schedule));
r.get('/availability/today',asyncHandler(c.todayAvailability));
r.post('/blocked-times/today',blockTodayRules,validateRequest,asyncHandler(c.blockToday));
r.delete('/blocked-times/today/:id',unblockTodayRules,validateRequest,asyncHandler(c.unblockToday));
export default r;
