import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "react-icons/fa";
import { transformWithOxc } from "vite";
import * as dates from "../src/utils/scheduleDates.js";

// Exercise the real page/control event handlers with API-shaped fixtures and
// isolated hook state, following the existing frontend component-test pattern.
async function compile(file, result) {
  const source = (await readFile(new URL(file, import.meta.url), "utf8"))
    .replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace(/export default /g, "");
  const { code } = await transformWithOxc(source, file, { jsx: { runtime: "classic" } });
  return bindings => new Function(...Object.keys(bindings), `${code}\nreturn ${result};`)(...Object.values(bindings));
}
const common = { React, ...icons, ...dates };
const Navigation = (await compile("../src/components/ScheduleDateNavigation.jsx", "ScheduleDateNavigation"))(common);
const factories = {};
for (const role of ["Doctor", "Admin"]) factories[role] = await compile(`../src/pages/${role}Schedule.jsx`, `{ Content: ${role}ScheduleContent, Page: ${role}Schedule }`);

function elements(tree, predicate) {
  const found = [];
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!React.isValidElement(node)) return;
    if (predicate(node)) found.push(node);
    walk(node.props.children);
  }
  walk(tree);
  return found;
}
function harness(role, appointments = [], initialToday = "2026-10-08") {
  const states = [], navigations = [];
  let cursor = 0, today = initialToday, locationKey = "first";
  const { Content, Page } = factories[role]({ ...common,
    getClinicDateKey: () => today,
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useMemo: compute => compute(),
    useNavigate: () => (...args) => navigations.push(args),
    useLocation: () => ({ key: locationKey }),
    useAppointments: () => ({ appointments, loading: false, error: "" }),
    useIdentity: () => ({ patients: [] }),
    DoctorLayout: ({ children }) => React.createElement("main", null, children),
    AdminLayout: ({ children }) => React.createElement("main", null, children),
    ScheduleDateNavigation: Navigation,
  });
  const render = () => { cursor = 0; return Content(); };
  const control = () => Navigation(elements(render(), node => node.type === Navigation)[0].props);
  const choose = value => elements(control(), node => node.type === "input")[0].props.onChange({ target: { value } });
  const arrow = label => elements(control(), node => node.props["aria-label"] === label)[0].props.onClick();
  const view = value => elements(render(), node => node.props.role === "tab" && node.props.children === value)[0].props.onClick();
  return { render, control, choose, arrow, view, navigations, html: () => renderToStaticMarkup(render()), selected: () => elements(control(), node => node.type === "input")[0].props.value,
    reopen: newToday => { const before = Page().key; locationKey = "reopened"; today = newToday; assert.notEqual(Page().key, before); states.length = 0; },
  };
}
const fixture = (id, date, status = "Confirmed", time = "10:00") => ({ id, date, status, time, patientId: `PAT-${id}`, patientName: `Patient ${id}`, doctorId: "DR-1", doctorName: "Doctor Test", service: `Service ${id}` });

for (const role of ["Doctor", "Admin"]) {
  test(`${role}: opens on today, picker and arrows change the rendered week, reopening resets to current date`, () => {
    const page = harness(role);
    assert.equal(page.selected(), "2026-10-08");
    assert.match(page.html(), /5 Oct/);
    page.choose("2027-01-01");
    assert.match(page.html(), /28 Dec/);
    assert.match(page.html(), /3 Jan/);
    page.arrow("Next week");
    assert.equal(page.selected(), "2027-01-08");
    page.arrow("Previous week");
    assert.equal(page.selected(), "2027-01-01");
    page.choose("");
    assert.equal(page.selected(), "2027-01-01");
    page.reopen("2026-10-09");
    assert.equal(page.selected(), "2026-10-09");
  });

  test(`${role}: selecting a date displays its confirmed, pending and completed appointments only`, () => {
    const appointments = [fixture("OLD", "2020-02-03"), fixture("PENDING", "2020-02-03", "Pending", "11:00"), fixture("COMPLETE", "2020-02-03", "Completed", "12:00"), fixture("CANCELLED", "2020-02-03", "Cancelled"), fixture("FUTURE", "2035-01-01")];
    const original = structuredClone(appointments);
    const page = harness(role, appointments);
    page.choose("2020-02-03");
    const grid = elements(page.render(), node => node.props.className === (role === "Doctor" ? "doctor-calendar-grid" : "admin-schedule-grid"))[0];
    const html = renderToStaticMarkup(grid);
    for (const id of ["OLD", "PENDING", "COMPLETE"]) assert.ok(html.includes(`Service ${id}`));
    assert.doesNotMatch(html, /Service CANCELLED|Service FUTURE/);
    assert.deepEqual(appointments, original);
  });
}

test("Doctor day arrows move one day; view switches preserve selected date and Sunday remains closed", () => {
  const page = harness("Doctor", [fixture("SAT", "2026-10-10"), fixture("MON", "2026-10-12")]);
  page.view("Day");
  assert.match(page.html(), /Thursday Schedule/);
  page.choose("2026-10-10");
  assert.match(page.html(), /Saturday Schedule/);
  page.arrow("Next day");
  assert.equal(page.selected(), "2026-10-11");
  assert.match(page.html(), /Sunday Schedule/);
  const grid = elements(page.render(), node => node.props.className === "doctor-calendar-grid")[0];
  assert.equal(elements(grid, node => node.props.className === "doctor-calendar-empty").length, 0);
  assert.equal(elements(grid, node => node.props.className === "doctor-calendar-closed").length, 10);
  page.arrow("Next day");
  assert.equal(page.selected(), "2026-10-12");
  page.arrow("Previous day");
  assert.equal(page.selected(), "2026-10-11");
  page.view("Week");
  assert.equal(page.selected(), "2026-10-11");
  page.view("Day");
  assert.match(page.html(), /Sunday Schedule/);
});

test("Doctor blocked slots stay on their exact date across picker jumps and day/week switches", () => {
  const page = harness("Doctor");
  page.view("Day");
  page.choose("2026-10-08");
  elements(page.render(), node => node.props["aria-label"] === "Block Thursday at 9:00 AM")[0].props.onClick();
  assert.equal(elements(page.render(), node => node.props.className === "doctor-calendar-blocked").length, 1);
  page.choose("2026-10-15");
  assert.equal(elements(page.render(), node => node.props.className === "doctor-calendar-blocked").length, 0);
  page.choose("2026-10-08");
  page.view("Week");
  const blocks = elements(page.render(), node => node.props.className === "doctor-calendar-blocked");
  assert.equal(blocks.length, 1);
  blocks[0].props.onClick();
  assert.equal(elements(page.render(), node => node.props.className === "doctor-calendar-blocked").length, 0);
});

test("Doctor Today sidebar and Next Appointment Record action survive selecting a historical week", () => {
  const page = harness("Doctor", [fixture("TODAY", "2026-10-08"), fixture("OLD", "2020-01-01")]);
  page.choose("2020-01-01");
  const todayList = elements(page.render(), node => node.props.className === "doctor-today-list")[0];
  const html = renderToStaticMarkup(todayList);
  assert.match(html, /Service TODAY/);
  assert.doesNotMatch(html, /Service OLD/);
  const actions = elements(page.render(), node => node.props.className === "doctor-next-actions")[0];
  elements(actions, node => node.type === "button")[0].props.onClick();
  assert.deepEqual(page.navigations[0], ["/doctor-patient-records", { state: { patientId: "PAT-TODAY", appointmentId: "TODAY", from: "/doctor-schedule" } }]);
});
