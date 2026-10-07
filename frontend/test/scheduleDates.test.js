import test from "node:test";
import assert from "node:assert/strict";
import { getClinicDateKey, getScheduleDays, isScheduleDate, moveScheduleDate, scheduleDateLabel, scheduleTimeKey } from "../src/utils/scheduleDates.js";

test("today uses the Kuala Lumpur calendar date at the UTC date boundary", () => {
  assert.equal(getClinicDateKey(new Date("2026-10-07T15:59:59Z")), "2026-10-07");
  assert.equal(getClinicDateKey(new Date("2026-10-07T16:00:00Z")), "2026-10-08");
  assert.equal(getClinicDateKey(new Date("2026-12-31T16:00:00Z")), "2027-01-01");
});

test("weeks run Monday through Sunday, including selected Sundays and year boundaries", () => {
  for (const selected of ["2026-12-28", "2027-01-01", "2027-01-03"]) {
    const days = getScheduleDays(selected);
    assert.equal(days[0].date, "2026-12-28");
    assert.equal(days[6].date, "2027-01-03");
    assert.equal(days[0].name, "Monday");
    assert.equal(days[6].name, "Sunday");
    assert.ok(days.some(day => day.date === selected));
  }
  assert.match(scheduleDateLabel("2027-01-01"), /2026.*2027/);
});

test("daily selection and arrows cross month, year, leap-day and DST boundaries without drift", () => {
  assert.deepEqual(getScheduleDays("2028-02-29", "day"), [{ date: "2028-02-29", name: "Tuesday", index: 1 }]);
  for (const [from, next] of [["2028-02-28", "2028-02-29"], ["2028-02-29", "2028-03-01"], ["2026-12-31", "2027-01-01"], ["2026-03-08", "2026-03-09"]]) {
    assert.equal(moveScheduleDate(from, 1, "day"), next);
    assert.equal(moveScheduleDate(next, -1, "day"), from);
  }
  assert.equal(moveScheduleDate("2026-12-31", 1), "2027-01-07");
  assert.equal(moveScheduleDate("2027-01-07", -1), "2026-12-31");
});

test("picker accepts valid past/future dates and ignores empty or invalid values", () => {
  for (const value of ["2020-01-01", "2035-12-31", "2028-02-29"]) assert.equal(isScheduleDate(value), true);
  for (const value of ["", undefined, "not-a-date", "2026-02-29", "2026-04-31"]) assert.equal(isScheduleDate(value), false);
});

test("API times and displayed slot labels match without changing appointment data", () => {
  assert.equal(scheduleTimeKey("10:00"), scheduleTimeKey("10:00 AM"));
  assert.equal(scheduleTimeKey("13:00:00"), scheduleTimeKey("1:00 PM"));
  assert.equal(scheduleTimeKey("12:00 AM"), "00:00");
  assert.equal(scheduleTimeKey("12:00 PM"), "12:00");
});
