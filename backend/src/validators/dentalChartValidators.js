import {body,param} from 'express-validator';
const publicId=value=>/^[A-Za-z0-9-]+$/.test(value);
export const chartPatientRules=[param('patientId').trim().isLength({min:1,max:32}).custom(publicId)];
export const chartEntryIdRules=[...chartPatientRules,param('entryId').trim().isLength({min:1,max:40}).custom(publicId)];
const payload=[body('recordId').trim().isLength({min:1,max:32}).custom(publicId),body('toothNumber').isString().matches(/^[1-4][1-8]$/),body('surfaces').isArray({min:1,max:6}),body('surfaces.*').isIn(['Mesial','Distal','Buccal','Facial','Lingual','Palatal','Occlusal','Incisal','Whole']),body('definitionId').trim().isLength({min:1,max:40}).custom(publicId),body('remark').optional({nullable:true}).isString().isLength({max:5000})];
export const createChartEntryRules=[...chartPatientRules,...payload];
export const amendChartEntryRules=[...chartEntryIdRules,...payload,body('amendmentReason').trim().isLength({min:2,max:1000})];
