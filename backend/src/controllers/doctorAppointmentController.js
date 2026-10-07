import * as service from '../services/appointmentService.js';
import { db } from '../config/database.js';
import { doctorTodayAvailability, blockDoctorToday, unblockDoctorToday } from '../services/doctorTodayAvailabilityService.js';
export async function list(req,res){res.json({status:'success',appointments:await service.doctorList(req.user.id,false)});}
export async function schedule(req,res){res.json({status:'success',appointments:await service.doctorList(req.user.id,true)});}
export async function todayAvailability(req,res){res.set('Cache-Control','no-store');res.json({status:'success',availability:await doctorTodayAvailability(db,req.user.id)});}
export async function blockToday(req,res){await blockDoctorToday(req.user.id,req.body,req.ip);res.status(201).json({status:'success'});}
export async function unblockToday(req,res){await unblockDoctorToday(req.user.id,req.params.id,req.ip);res.json({status:'success'});}
