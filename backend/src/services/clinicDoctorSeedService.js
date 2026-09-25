import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { db } from '../config/database.js';
import { env } from '../config/env.js';
import { inTransaction } from './authService.js';

const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export async function seedClinicDoctors(){
  if(env.nodeEnv==='production')throw new Error('Development doctor seed is disabled in production.');
  return inTransaction(async c=>{
    const updates=[
      ['DOC-DEV-ROSNI','Dr. Rosni binti Adam',null,'PENDING-VERIFICATION-ROSNI'],
      ['DOC-DEV-DOCTOR-B','Dr. Muhammad Nur Syahidi bin Sahnon','General','PENDING-VERIFICATION-SYAHIDI'],
    ];
    for(const [code,name,specialization,license] of updates){
      const[rows]=await c.execute('SELECT d.id,d.user_id FROM doctors d WHERE d.doctor_id=? LIMIT 1 FOR UPDATE',[code]);
      if(rows.length!==1)throw new Error(`Expected existing doctor ${code} before clinic doctor seed.`);
      await c.execute('UPDATE users SET full_name=? WHERE id=?',[name,rows[0].user_id]);
      await c.execute('UPDATE doctors SET specialization=?,license_number=? WHERE id=?',[specialization,license,rows[0].id]);
    }
    const[existing]=await c.execute("SELECT d.id,d.user_id FROM doctors d WHERE d.doctor_id='DOC-CLINIC-NORA' LIMIT 1 FOR UPDATE");
    let nora=existing[0];
    if(!nora){
      const[duplicates]=await c.execute("SELECT d.id FROM doctors d JOIN users u ON u.id=d.user_id WHERE u.full_name='Dr. Nora Rizka binti Mohamad' LIMIT 1");
      if(duplicates.length)throw new Error('Dr. Nora already exists under another doctor ID; manual ID mapping is required.');
      const hash=await bcrypt.hash(randomBytes(32).toString('base64url'),env.bcryptSaltRounds);
      const[user]=await c.execute("INSERT INTO users(user_id,full_name,email,password_hash,role) VALUES('USR-CLINIC-NORA','Dr. Nora Rizka binti Mohamad',NULL,?,'Doctor')",[hash]);
      const[doctor]=await c.execute("INSERT INTO doctors(doctor_id,user_id,professional_title,specialization,license_number) VALUES('DOC-CLINIC-NORA',?,'Dr.','Specialist Orthodontist','PENDING-VERIFICATION-NORA')",[user.insertId]);
      nora={id:doctor.insertId,user_id:user.insertId};
    }else{
      await c.execute('UPDATE users SET full_name=? WHERE id=?',['Dr. Nora Rizka binti Mohamad',nora.user_id]);
      await c.execute('UPDATE doctors SET specialization=? WHERE id=?',['Specialist Orthodontist',nora.id]);
    }
    // The monthly rule is authoritative for this doctor; weekly hours stay closed as a safe fallback.
    for(const day of days)await c.execute("INSERT INTO doctor_working_hours(doctor_id,day_of_week,is_working,start_time,end_time) VALUES(?,?,0,NULL,NULL) ON DUPLICATE KEY UPDATE is_working=0,start_time=NULL,end_time=NULL",[nora.id,day]);
    await c.execute("INSERT INTO doctor_monthly_availability(doctor_id,week_of_month,day_of_week,is_enabled) VALUES(?,1,'Saturday',1) ON DUPLICATE KEY UPDATE is_enabled=1",[nora.id]);
    return {updated:updates.map(([code])=>code),visitingDoctor:'DOC-CLINIC-NORA',monthlyRule:'first Saturday'};
  });
}
