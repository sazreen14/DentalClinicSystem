import { body, param } from "express-validator";

export const blockTodayRules = [
  body().custom(value => value && !Array.isArray(value) && Object.keys(value).every(key => ["date", "time"].includes(key))),
  body("date").matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true }),
  body("time").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
];
export const unblockTodayRules = [param("id").isInt({ min: 1 })];
