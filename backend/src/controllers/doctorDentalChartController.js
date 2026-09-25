import * as service from '../services/dentalChartService.js';
export async function chart(request,response){response.json({status:'success',chart:await service.doctorChart(request.user.id,request.params.patientId)});}
export async function history(request,response){const value=await service.doctorChart(request.user.id,request.params.patientId);response.json({status:'success',patientId:value.patientId,history:value.history});}
export async function create(request,response){response.status(201).json({status:'success',entry:await service.createEntry(request.user.id,request.params.patientId,request.body,request)});}
export async function amend(request,response){response.status(201).json({status:'success',entry:await service.amendEntry(request.user.id,request.params.patientId,request.params.entryId,request.body,request)});}
