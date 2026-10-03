import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "react-icons/fa";
import * as serviceIcons from "react-icons/tb";
import { transformWithOxc } from "vite";

// Render the actual dashboard with synthetic API-shaped fixtures. Imports and
// effects are replaced so this test cannot contact the API or a database.
const source = await readFile(new URL("../src/pages/PatientDashboard.jsx", import.meta.url), "utf8");
const { code } = await transformWithOxc(
  source.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default PatientDashboard;", ""),
  "PatientDashboard.jsx",
  { jsx: { runtime: "classic" } },
);

function renderDashboard(appointments, recentVisits = [], completedVisitCount = 0, inspect = null, navigate = () => {}) {
  const states = [{ recentVisits, completedVisitCount }, false, "", false];
  const bindings = {
    React,
    ...icons,
    ...serviceIcons,
    useEffect: () => {},
    useState: () => [states.shift(), () => {}],
    useNavigate: () => navigate,
    useAppointments: () => ({ appointments, loading: false, error: "", cancelAppointment: () => {} }),
    useIdentity: () => ({ patients: [{ patientId: "TEST-PATIENT", fullName: "Synthetic Patient", registrationDate: "2026-09-26", dateOfBirth: "2000-01-01" }], loading: false, error: "" }),
    useAuth: () => ({ user: { patientId: "TEST-PATIENT" } }),
    useNotifications: () => ({ getUnreadCount: () => 0 }),
    APPOINTMENT_REFERENCE_DATE: "2026-09-26",
    PatientLayout: ({ children }) => React.createElement("main", null, children),
    AppointmentModal: () => null,
  };
  const Dashboard = new Function(...Object.keys(bindings), `${code}\nreturn PatientDashboard;`)(...Object.values(bindings));
  if (inspect) return inspect(Dashboard());
  return renderToStaticMarkup(React.createElement(Dashboard));
}

const appointment = (overrides = {}) => ({
  id: "TEST-APPOINTMENT", date: "2026-09-27", time: "10:00",
  service: "Synthetic service", doctorName: "Synthetic Doctor", status: "Confirmed",
  ...overrides,
});

function nextCard(html) {
  return html.match(/<article[^>]*><div[^>]*><h3>Next Appointment<\/h3>[\s\S]*?<\/article>/)?.[0] || "";
}

for (const [name, appointments] of [
  ["new patient with no appointments", []],
  ["patient with only cancelled appointments", [appointment({ status: "Cancelled" })]],
]) {
  test(name, () => {
    const html = renderDashboard(appointments);
    const card = nextCard(html);
    assert.match(card, /No upcoming appointment/);
    assert.doesNotMatch(card, /patient-figma-confirmed|patient-figma-appointment-meta|Synthetic Doctor|Synthetic service|Reschedule|>Cancel</);
    // The All appointments chevron is allowed; appointment-detail icons are not.
    assert.equal((card.match(/<svg/g) || []).length, 1);
    assert.match(html, /Book Appointment/);
    assert.match(html, /<strong>0<\/strong><span>Total Visits<\/span><small>Completed visits/);
    for (const label of ["Upcoming", "Records", "Unread Alerts"]) {
      assert.ok(html.includes(`<strong>0</strong><span>${label}</span>`));
    }
    assert.match(html, /No clinical visits recorded yet\./);
    assert.match(html, /Not available/);
    assert.doesNotMatch(html, /Since 2022/);
  });
}

for (const status of ["Pending", "Confirmed"]) {
  test(`patient with a ${status.toLowerCase()} upcoming appointment`, () => {
    const appointments = [
      appointment({ id: "LATER", date: "2026-09-28", service: "Later service" }),
      appointment({ id: "CANCELLED", date: "2026-09-26", status: "Cancelled" }),
      appointment({ id: "COMPLETED", date: "2026-09-26", status: "Completed" }),
      appointment({ id: "PAST", date: "2026-09-25", service: "Past service" }),
      appointment({ status }),
    ];
    const original = structuredClone(appointments);
    const html = renderDashboard(appointments, [], 1);
    const card = nextCard(html);
    assert.match(card, /Synthetic service/);
    assert.match(card, /Synthetic Doctor/);
    assert.match(card, /27 September 2026/);
    assert.match(card, /10:00/);
    assert.match(card, /Klinik Pergigian Rosni Adam/);
    assert.ok(card.includes(`>${status}</span>`));
    assert.match(card, /Reschedule/);
    assert.match(card, />Cancel</);
    assert.doesNotMatch(card, /No upcoming appointment|Cancelled|Later service|Past service/);
    assert.match(html, /<strong>1<\/strong><span>Total Visits/);
    assert.match(html, /<strong>2<\/strong><span>Upcoming/);
    assert.deepEqual(appointments, original);
  });
}


test("Recent Visits displays completed appointments in newest-first order", () => {
  const visits = [
    { id: 3, date: "2026-09-25", treatment: "Latest treatment", doctor: "Test Doctor", status: "Completed" },
    { id: 2, date: "2026-09-24", treatment: "Earlier treatment", doctor: "Test Doctor", status: "Completed" },
  ];
  const html = renderDashboard(visits.map(visit => appointment({ ...visit, service: visit.treatment } )).reverse());
  assert.match(html, /<strong>2<\/strong><span>Total Visits/);
  assert.match(html, /Latest treatment/);
  assert.match(html, /Earlier treatment/);
  assert.ok(html.indexOf("Latest treatment") < html.indexOf("Earlier treatment"));
  assert.doesNotMatch(html, /No clinical visits recorded yet/);
});

test("Recent Visits View all opens Appointments with Completed selected; normal navigation stays Upcoming", async () => {
  let destination;
  const walk = node => {
    if (!node || typeof node !== "object") return;
    if (node.type === "button" && React.Children.toArray(node.props.children).includes("View all")) node.props.onClick();
    React.Children.forEach(node.props?.children, walk);
  };
  renderDashboard([], [], 0, walk, (...args) => { destination = args; });
  assert.deepEqual(destination, ["/patient-appointments", { state: { tab: "completed" } }]);
  const pageSource = await readFile(new URL("../src/pages/PatientAppointments.jsx", import.meta.url), "utf8");
  const { code: pageCode } = await transformWithOxc(pageSource.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default PatientAppointments;", ""), "PatientAppointments.jsx", { jsx: { runtime: "classic" } });
  for (const [state, heading, shown, hidden] of [
    [destination[1].state, "Completed Appointments", "Completed fixture", "Upcoming fixture"],
    [null, "Upcoming Appointments", "Upcoming fixture", "Completed fixture"],
  ]) {
    const bindings = { React, ...icons, useLocation: () => ({ state }), useState: initial => [initial, () => {}],
      useAppointments: () => ({ appointments: [appointment({ id: "DONE", status: "Completed", service: "Completed fixture" }), appointment({ service: "Upcoming fixture" })], loading: false, error: "" }),
      APPOINTMENT_REFERENCE_DATE: "2026-09-26", PatientLayout: ({ children }) => React.createElement("main", null, children), AppointmentModal: () => null };
    const Page = new Function(...Object.keys(bindings), `${pageCode}\nreturn PatientAppointments;`)(...Object.values(bindings));
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.ok(html.includes(heading));
    assert.ok(html.includes(shown));
    assert.ok(!html.includes(hidden));
  }
});

test("Recent Visits and Total Visits ignore conflicting historical clinical summaries", () => {
  const html = renderDashboard([
    appointment({ service: "Tooth Filling", date: "2026-09-30", doctorName: "Dr. Rosni binti Adam", status: "Completed" }),
    appointment({ id: "CANCELLED", service: "Cancelled service", status: "Cancelled" }),
  ], [{ id: 99, treatment: "Dental Consultation", date: "2026-09-26", doctor: "Historical doctor", status: "Completed" }], 9);
  assert.match(html, /<strong>1<\/strong><span>Total Visits/);
  assert.match(html, /Tooth Filling/);
  assert.match(html, /30 September 2026/);
  assert.match(html, /Dr\. Rosni binti Adam/);
  assert.doesNotMatch(html, /Dental Consultation|Historical doctor|Cancelled service/);
});
