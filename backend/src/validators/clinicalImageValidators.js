import {body,param,query} from 'express-validator';
const publicId=value=>/^[A-Za-z0-9-]+$/.test(value);
export const imagePatientRules=[param('patientId').trim().isLength({min:1,max:32}).custom(publicId)];
export const imageListRules=[...imagePatientRules,query('status').optional().isIn(['active','all'])];
export const imageIdRules=[...imagePatientRules,param('imageId').trim().isLength({min:1,max:40}).custom(publicId)];
export const imageUploadRules=[...imagePatientRules,body('recordId').trim().isLength({min:1,max:32}).custom(publicId),body('caption').optional({nullable:true}).isString().isLength({max:1000})];
