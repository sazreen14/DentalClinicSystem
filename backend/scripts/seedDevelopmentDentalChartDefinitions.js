import 'dotenv/config';
import {db,closeDatabase} from '../src/config/database.js';
import {env} from '../src/config/env.js';

if(env.nodeEnv==='production')throw new Error('Development Dental Chart definitions are disabled in production');
const definitions=[
  ['DCD-DEV-OBSERVATION','DEV-OBS','[Development] Observation','Development','#F59E0B','dot',null],
  ['DCD-DEV-CONDITION','DEV-COND','[Development] Condition','Development','#EF4444','ring',null],
  ['DCD-DEV-PROCEDURE','DEV-PROC','[Development] Procedure','Development','#2563EB','fill',null]
];
try{
  for(const value of definitions)await db.execute(`INSERT INTO dental_chart_definitions(definition_id,code,label,category,display_color,symbol_key,pattern_key,is_active,is_development) VALUES(?,?,?,?,?,?,?,TRUE,TRUE) ON DUPLICATE KEY UPDATE label=VALUES(label),category=VALUES(category),display_color=VALUES(display_color),symbol_key=VALUES(symbol_key),pattern_key=VALUES(pattern_key),is_active=TRUE,is_development=TRUE`,value);
  console.log(`Development Dental Chart definitions ready: ${definitions.map(value=>value[1]).join(', ')}`);
}finally{await closeDatabase();}
