import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import * as icons from "react-icons/fa";
import * as serviceIcons from "react-icons/tb";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

test("booking details use only the current profile, remain read-only and preserve notes and submission", async () => {
  const source = await readFile(new URL("../src/components/modals/AppointmentModal.jsx", import.meta.url), "utf8");
  const { code } = await transformWithOxc(source.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default AppointmentModal;", ""), "AppointmentModal.jsx", { jsx: { runtime: "classic" } });
  const patient = { patientId: "P-A", fullName: "Test Patient A", identityNumber: "TEST-A", phone: "0000000000", email: "a@example.test" };
  const other = { patientId: "P-B", fullName: "Test Patient B", identityNumber: "TEST-B", phone: "1111111111", email: "b@example.test" };
  let auth = { user: { role: "Patient", patientId: "P-A" }, isAuthenticated: true };
  let identity = { patients: [other, patient], loading: false, error: "" };
  const states = [], requests = [];
  let index = 0, changeStep, changeBooking;
  const bindings = {
    React, ...icons, ...serviceIcons, useMemo: callback => callback(), useEffect: () => {},
    useAuth: () => auth, useIdentity: () => identity,
    useClinicOperations: () => ({ clinicInfo: { clinicName: "Test Clinic" } }),
    useAppointments: () => ({ addAppointment: async value => requests.push(value) }),
    useState: initial => {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      const set = value => { states[slot] = typeof value === "function" ? value(states[slot]) : value; };
      if (initial === 1) changeStep = set;
      if (initial?.notes === "") changeBooking = set;
      return [states[slot], set];
    },
  };
  const Page = new Function(...Object.keys(bindings), `${code}\nreturn AppointmentModal;`)(...Object.values(bindings));
  const render = () => { index = 0; return Page({ onClose() {} }); };
  function find(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    return React.Children.toArray(node.props?.children).map(child => find(child, predicate)).find(Boolean);
  }
  const input = name => find(render(), node => node.props?.name === name);
  const review = () => find(render(), node => node.type === "button" && renderToStaticMarkup(node).includes("Review Booking"));
  render(); changeStep(4);
  for (const [name, value] of Object.entries({ fullName: patient.fullName, icNumber: patient.identityNumber, phone: patient.phone, email: patient.email })) {
    assert.equal(input(name).props.value, value);
    assert.equal(input(name).props.readOnly, true);
    assert.equal(input(name).props.onChange, undefined);
  }
  input("notes").props.onChange({ target: { name: "notes", value: "Test note" } });
  assert.equal(input("notes").props.value, "Test note");
  assert.equal(review().props.disabled, false);
  identity = { ...identity, loading: true };
  assert.equal(input("fullName").props.value, "");
  assert.equal(review().props.disabled, true);
  identity = { ...identity, loading: false, error: "Network unavailable" };
  assert.equal(review().props.disabled, true);
  identity = { patients: [{ ...patient, phone: "" }], loading: false, error: "" };
  assert.equal(review().props.disabled, true);
  assert.match(renderToStaticMarkup(render()), /Please update My Profile/);
  identity = { ...identity, patients: [other, patient] };
  auth = { ...auth, user: { role: "Patient", patientId: "P-B" } };
  assert.equal(input("email").props.value, other.email);
  assert.doesNotMatch(renderToStaticMarkup(render()), /a@example.test/);
  auth = { ...auth, isAuthenticated: false };
  assert.equal(input("email").props.value, "");
  assert.equal(review().props.disabled, true);
  auth = { user: { role: "Patient", patientId: "P-A" }, isAuthenticated: true };
  changeBooking(previous => ({ ...previous, service: { id: "SERVICE" }, doctor: { id: "DOCTOR" }, date: "2030-01-01", time: "09:00" }));
  review().props.onClick();
  assert.match(renderToStaticMarkup(render()), /a@example.test/);
  await find(render(), node => node.type === "button" && renderToStaticMarkup(node).includes("Confirm Appointment")).props.onClick();
  assert.deepEqual(requests, [{ dentalServiceId: "SERVICE", doctorId: "DOCTOR", date: "2030-01-01", time: "09:00", patientNote: "Test note" }]);
});
