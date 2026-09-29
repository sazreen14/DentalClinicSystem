import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import {db} from '../src/config/database.js';
import {photoDirectory} from '../src/services/patientPhotoService.js';

const suffix=randomUUID().replaceAll('-','').slice(0,12);
const password='DoctorPhoto9Password';
let server,base,first,second,firstToken,secondToken;
const created=[];

async function createDoctor(number){
  const email=`doctor.photo.${suffix}.${number}@example.test`;
  const [user]=await db.execute("INSERT INTO users(user_id,full_name,email,password_hash,role,account_status) VALUES(?,?,?,?, 'Doctor','Active')",[`USR-PHOTO-${suffix}-${number}`,`Photo Doctor ${number}`,email,await bcrypt.hash(password,10)]);
  await db.execute('INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,?,?)',[`DOC-PHOTO-${suffix}-${number}`,user.insertId,'Dr.',`LIC-PHOTO-${suffix}-${number}`]);
  created.push(user.insertId);
  return {id:user.insertId,email};
}
async function login(doctor){const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:doctor.email,password})});assert.equal(response.status,200);return(await response.json()).accessToken;}
async function profile(token){const response=await fetch(`${base}/api/doctor/profile`,{headers:{authorization:`Bearer ${token}`}});assert.equal(response.status,200);return(await response.json()).doctor;}
async function upload(token,filename,mime,bytes){const form=new FormData();form.append('photo',new Blob([bytes],{type:mime}),filename);return fetch(`${base}/api/doctor/profile/photo`,{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:form});}

before(async()=>{await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',()=>{base=`http://127.0.0.1:${server.address().port}`;resolve();});});first=await createDoctor(1);second=await createDoctor(2);firstToken=await login(first);secondToken=await login(second);});
after(async()=>{for(const userId of created){const[[row]]=await db.execute('SELECT profile_photo_key FROM doctors WHERE user_id=?',[userId]);if(row?.profile_photo_key)await unlink(path.join(photoDirectory,row.profile_photo_key)).catch(()=>{});await db.execute('DELETE FROM security_audit_logs WHERE user_id=?',[userId]);await db.execute('DELETE FROM refresh_tokens WHERE user_id=?',[userId]);await db.execute('DELETE FROM doctors WHERE user_id=?',[userId]);await db.execute('DELETE FROM users WHERE id=?',[userId]);}server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));});

test('Doctor photo upload reuses validated storage, persists, and is account scoped',async()=>{
  assert.equal((await profile(firstToken)).photoUrl,null);
  const jpg=Buffer.from([0xff,0xd8,0xff,0xe0,0,1,2,3,0xff,0xd9]);
  const png=await readFile(new URL('../../frontend/src/assets/hero.png',import.meta.url));
  const webp=await readFile(new URL('../../frontend/src/assets/images/clinic.jpg',import.meta.url));
  assert.equal((await upload(null,'photo.jpg','image/jpeg',jpg)).status,401);
  for(const[filename,mime,bytes]of[['photo.jpg','image/jpeg',jpg],['photo.png','image/png',png],['photo.webp','image/webp',webp]]){
    const response=await upload(firstToken,filename,mime,bytes);assert.equal(response.status,200,`${filename}: ${await response.clone().text()}`);
    const doctor=(await response.json()).doctor;
    assert.match(doctor.photoUrl,/^\/api\/public\/profile-photos\/[a-f0-9]{48}\.(jpg|png|webp)$/);
    assert.equal(doctor.photoUrl.includes('uploads'),false);
    const image=await fetch(`${base}${doctor.photoUrl}`,{headers:{authorization:`Bearer ${firstToken}`}});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),mime);
    assert.equal((await profile(firstToken)).photoUrl,doctor.photoUrl);
    assert.equal((await profile(await login(first))).photoUrl,doctor.photoUrl);
  }
  assert.equal((await upload(firstToken,'wrong.txt','image/jpeg',jpg)).status,422);
  assert.equal((await upload(firstToken,'wrong.png','image/png',jpg)).status,422);
  assert.equal((await upload(firstToken,'big.png','image/png',Buffer.alloc(2*1024*1024+1))).status,422);
  const firstPhoto=(await profile(firstToken)).photoUrl;
  const secondUpload=await upload(secondToken,'other.jpg','image/jpeg',jpg);assert.equal(secondUpload.status,200);
  assert.notEqual((await secondUpload.json()).doctor.photoUrl,firstPhoto);
  assert.equal((await profile(firstToken)).photoUrl,firstPhoto);
  assert.equal((await profile(secondToken)).photoUrl===firstPhoto,false);
});
