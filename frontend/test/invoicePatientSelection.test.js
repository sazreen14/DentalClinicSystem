import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { transformWithOxc } from 'vite';
import { FaPlus, FaTimes } from 'react-icons/fa';

test('invoice patient search filters names and IDs and preserves appointment selection and submission', async () => {
  const source = await readFile(new URL('../src/components/invoices/InvoiceWorkspace.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source.slice(source.indexOf('function CreateInvoiceModal(')), 'Modal.jsx', { jsx: { runtime: 'classic' } });
  const states = [], submissions = [];
  let cursor = 0;
  const bindings = { React, FaPlus, FaTimes, EMPTY_ITEM: { description: '', quantity: 1, unitPrice: '0.00' }, money: value => String(value),
    useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    createInvoice: async value => { submissions.push(value); return value; } };
  const Modal = new Function(...Object.keys(bindings), `${code}\nreturn CreateInvoiceModal;`)(...Object.values(bindings));
  const props = { patients: [
    { patientId: 'PT-001', fullName: 'Alice Example', accountStatus: 'Active' },
    { patientId: 'PT-002', fullName: 'Bob Example', accountStatus: 'Active' },
    { patientId: 'PT-003', fullName: 'Alice Inactive', accountStatus: 'Inactive' },
  ], appointments: [{ id: 'A1', patientId: 'PT-001' }, { id: 'A2', patientId: 'PT-002' }], onCreated: () => {}, onError: error => { throw new Error(error); } };
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)]; }
  const render = () => { cursor = 0; return nodes(Modal(props)); };
  const field = () => render().find(node => node.props?.role === 'combobox');
  const search = value => field().props.onChange({ target: { value } });
  const results = () => render().filter(node => node.props?.role === 'option');
  field().props.onFocus();
  assert.equal(results().length, 2);
  assert.equal(render().filter(node => node.type === 'select').length, 1);
  search('  aLiCe  ');
  assert.deepEqual(results().map(node => node.props.children), ['Alice Example \u00b7 PT-001']);
  search('pt-002');
  assert.deepEqual(results().map(node => node.props.children), ['Bob Example \u00b7 PT-002']);
  results()[0].props.onClick();
  assert.equal(field().props.value, 'Bob Example \u00b7 PT-002');
  assert.equal(field().props['aria-expanded'], false);
  assert.equal(results().length, 0);
  const appointmentSelect = () => render().find(node => node.type === 'select');
  assert.deepEqual(nodes(appointmentSelect()).filter(node => node.type === 'option').map(node => node.props.value), ['', 'A2']);
  appointmentSelect().props.onChange({ target: { value: 'A2' } });
  const submit = () => render().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await submit();
  assert.equal(submissions[0].patientId, 'PT-002');
  assert.equal(submissions[0].appointmentId, 'A2');
  field().props.onFocus();
  search('alice');
  results()[0].props.onClick();
  assert.equal(field().props.value, 'Alice Example \u00b7 PT-001');
  assert.equal(appointmentSelect().props.value, '');
  assert.deepEqual(nodes(appointmentSelect()).filter(node => node.type === 'option').map(node => node.props.value), ['', 'A1']);
  await submit();
  assert.equal(submissions[1].patientId, 'PT-001');
  assert.equal(submissions[1].appointmentId, null);
  search('unmatched');
  assert.ok(render().some(node => node.props?.role === 'status' && node.props.children === 'No patients found'));
  await submit();
  assert.equal(submissions.length, 2);
  search('');
  assert.equal(results().length, 2);
  field().props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(field().props.value, 'Alice Example \u00b7 PT-001');
  assert.equal(field().props['aria-expanded'], false);
});
