import * as service from '../services/dentalChartService.js';
export async function chart(request,response){response.json({status:'success',chart:await service.adminChart(request.params.patientId)});}
export async function history(request,response){const value=await service.adminChart(request.params.patientId);response.json({status:'success',patientId:value.patientId,history:value.history});}
