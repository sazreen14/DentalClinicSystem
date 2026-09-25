import * as service from '../services/appointmentService.js';
export async function list(req,res){res.json({status:'success',appointments:await service.doctorList(req.user.id,false)});}
export async function schedule(req,res){res.json({status:'success',appointments:await service.doctorList(req.user.id,true)});}
