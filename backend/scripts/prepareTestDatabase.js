import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {env} from '../src/config/env.js';

if(env.nodeEnv!=='test'||!/_test$/i.test(env.db.database))throw new Error('Test database preparation requires NODE_ENV=test and a DB_NAME ending with _test.');
if(!/^[A-Za-z0-9_]+$/.test(env.db.database))throw new Error('Test database name contains unsupported characters.');
if(!process.argv.includes('--reset'))throw new Error('Pass --reset to explicitly recreate the disposable test database.');

const schemaPath=fileURLToPath(new URL('../database/schema.sql',import.meta.url));
const raw=await readFile(schemaPath,'utf8');
const schema=raw
  .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/i,'')
  .replace(/\bUSE\s+[^;]+;/i,'')
  .replace(/CREATE TABLE password_reset_tokens\s*\([\s\S]*?\) ENGINE=InnoDB;/i,'');
const statements=schema.split(/;\s*(?:\r?\n|$)/).map(value=>value.trim()).filter(Boolean);
const server=await mysql.createConnection({host:env.db.host,port:env.db.port,user:env.db.user,password:env.db.password,connectTimeout:env.db.connectTimeoutMs});
try{
  await server.query(`DROP DATABASE IF EXISTS \`${env.db.database}\``);
  await server.query(`CREATE DATABASE \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}finally{await server.end();}

const database=await mysql.createConnection({host:env.db.host,port:env.db.port,user:env.db.user,password:env.db.password,database:env.db.database,connectTimeout:env.db.connectTimeoutMs});
try{for(const statement of statements)await database.query(statement);}finally{await database.end();}
console.log(`Disposable test database baseline prepared: ${env.db.database}`);
