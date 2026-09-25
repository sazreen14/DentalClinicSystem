import {env} from '../../src/config/env.js';

const approvedTestDatabase=/_test$/i.test(env.db.database);
if(env.nodeEnv!=='test'||!approvedTestDatabase){
  throw new Error('Integration tests aborted: set NODE_ENV=test and use a dedicated database whose name ends with _test. No database connection was opened.');
}
