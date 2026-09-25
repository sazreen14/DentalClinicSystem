import * as service from '../services/appointmentService.js';
const ip=req=>req.ip??req.socket.remoteAddress??'unknown';
export async function list(_req,res){res.json({status:'success',appointments:await service.adminList()});}
export async function options(_req,res){res.json({status:'success',...(await service.options())});}
export async function create(req,res){res.status(201).json({status:'success',appointment:await service.adminCreate(req.user.id,req.body,ip(req))});}
export async function createForNewPatient(req,res){res.status(201).json({status:'success',appointment:await service.adminCreateForNewPatient(req.user.id,req.body,ip(req))});}
export async function confirm(req,res){res.json({status:'success',appointment:await service.adminConfirm(req.user.id,req.params.id,ip(req))});}
export async function reschedule(req,res){res.json({status:'success',appointment:await service.adminReschedule(req.user.id,req.params.id,req.body,ip(req))});}
export async function cancel(req,res){res.json({status:'success',appointment:await service.adminCancel(req.user.id,req.params.id,req.body.reason,ip(req))});}
