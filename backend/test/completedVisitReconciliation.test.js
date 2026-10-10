import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('historical inspection is scoped, SELECT-only and cannot apply changes', async () => {
  const source = await readFile(new URL('../src/services/completedVisitReconciliation.js', import.meta.url), 'utf8');
  const queries = [];
  const db = { execute: async (sql, values) => {
    queries.push({ sql, values });
    assert.match(sql.trim(), /^SELECT /);
    assert.doesNotMatch(sql, /\b(?:UPDATE|INSERT|DELETE|REPLACE|ALTER|DROP)\b/i);
    return [[{ id: 1, appointment_id: 'SYNTHETIC-APPOINTMENT' }]];
  } };
  const inspect = new Function('db', `${source.replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function')}\nreturn reconcileCompletedVisits;`)(db);
  await assert.rejects(inspect('SYNTHETIC-PATIENT', { apply: true }), /dry-run only/);
  await assert.rejects(inspect(''), /explicit patient code/);
  assert.equal(queries.length, 0);
  assert.deepEqual(await inspect('SYNTHETIC-PATIENT'), {
    eligible: 1, updated: 0, appointmentIds: ['SYNTHETIC-APPOINTMENT'],
  });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].values, ['SYNTHETIC-PATIENT']);
});
