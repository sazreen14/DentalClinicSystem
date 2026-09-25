import * as s from '../services/clinicOperationsService.js';
import {getGoogleReviews} from '../services/googleReviewsService.js';
export async function info(_q,r){r.json({status:'success',clinicInfo:await s.publicInfo()});}export async function hours(_q,r){r.json({status:'success',operatingHours:await s.publicHours()});}export async function services(_q,r){r.json({status:'success',dentalServices:await s.publicServices()});}
export async function reviews(_q,r){r.json({status:'success',reviews:await getGoogleReviews()});}
