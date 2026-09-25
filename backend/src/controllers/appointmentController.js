import * as service from '../services/appointmentService.js';
const ip=req=>req.ip??req.socket.remoteAddress??'unknown';
export async function myAppointments(req,res){res.json({status:'success',appointments:await service.patientList(req.user.id)});}
export async function bookingOptions(_req,res){res.json({status:'success',...(await service.options())});}
export async function availability(req,res){res.json({status:'success',availability:await service.availability(req.query)});}
export async function create(req,res){res.status(201).json({status:'success',appointment:await service.create(req.user.id,req.body,ip(req))});}
export async function cancel(req,res){res.json({status:'success',appointment:await service.patientCancel(req.user.id,req.params.id,req.body.reason,ip(req))});}
export async function reschedule(req,res){res.json({status:'success',appointment:await service.patientReschedule(req.user.id,req.params.id,req.body,ip(req))});}
