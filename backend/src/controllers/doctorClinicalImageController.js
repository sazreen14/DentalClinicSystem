import * as service from '../services/clinicalImageService.js';
function disposition(name){return String(name).replace(/[\r\n"\\]/g,'_');}
export async function list(q,r){r.json({status:'success',images:await service.doctorList(q.user.id,q.params.patientId,q.query.status==='all')});}
export async function upload(q,r){r.status(201).json({status:'success',image:await service.upload(q.user.id,q.params.patientId,q.body,q.file,q)});}
export async function content(q,r){const value=await service.content('Doctor',q.user.id,q.params.patientId,q.params.imageId,q);r.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':value.mime,'Content-Length':String(value.buffer.length),'Content-Disposition':`inline; filename="${disposition(value.filename)}"`}).send(value.buffer);}
export async function archive(q,r){r.json({status:'success',image:await service.archive(q.user.id,q.params.patientId,q.params.imageId,q)});}
