import {mkdir,open,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {env} from '../config/env.js';
const valid=/^[a-f0-9]{64}$/;
function location(key){if(!valid.test(key))throw new Error('Invalid clinical image storage key');const target=path.resolve(env.clinicalImages.storageRoot,key.slice(0,2),key.slice(2,4),`${key}.dci`);const root=path.resolve(env.clinicalImages.storageRoot);if(!target.startsWith(`${root}${path.sep}`))throw new Error('Invalid clinical image storage path');return target;}
export async function writeImage(key,buffer){const target=location(key);await mkdir(path.dirname(target),{recursive:true,mode:0o700});const handle=await open(target,'wx',0o600);try{await handle.writeFile(buffer);}finally{await handle.close();}}
export const readImage=key=>readFile(location(key));
export const removeImage=key=>rm(location(key),{force:true});
