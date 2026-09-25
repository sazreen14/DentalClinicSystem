import { sendAppointmentEmail } from "./emailService.js";

let sender = sendAppointmentEmail;

export function setAppointmentEmailSenderForTests(testSender) {
  sender = testSender ?? sendAppointmentEmail;
}

export async function runBestEffortEmail(eventName, task) {
  try {
    return await task();
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Appointment email dispatch failed", {
        event: eventName,
        error: error?.code || error?.name || "UNKNOWN_ERROR",
      });
    }
    return { status: "failed" };
  }
}

function dispatch(event, appointment, recipientEmail) {
  return runBestEffortEmail(event.toUpperCase(), () => sender(event, appointment, recipientEmail));
}

export const bookingAcknowledgementEmail = (appointment, recipientEmail) => dispatch("booked", appointment, recipientEmail);
export const appointmentConfirmationEmail = (appointment, recipientEmail) => dispatch("confirmed", appointment, recipientEmail);
export const appointmentRescheduleEmail = (appointment, recipientEmail) => dispatch("rescheduled", appointment, recipientEmail);
export const patientCancellationEmail = (appointment, recipientEmail) => dispatch("patientCancelled", appointment, recipientEmail);
export const adminCancellationEmail = (appointment, recipientEmail) => dispatch("adminCancelled", appointment, recipientEmail);
