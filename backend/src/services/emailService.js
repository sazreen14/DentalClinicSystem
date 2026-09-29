import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const CLINIC_NAME = "Klinik Pergigian Rosni Adam";
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const clinicSender = (config) => ({ name: CLINIC_NAME, address: config.clinicEmail });

function createSmtpTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.clinicEmail, pass: config.appPassword },
  });
}

function appointmentLines(appointment) {
  return [
    `Treatment: ${appointment.service}`,
    `Doctor: ${appointment.doctorName}`,
    `Date: ${appointment.date}`,
    `Time: ${appointment.time}`,
    `Appointment ID: ${appointment.id}`,
  ].join("\n");
}

const templates = {
  booked: (appointment) => ({
    subject: "Appointment request received",
    introduction: "We have received your appointment request. It is awaiting clinic confirmation.",
  }),
  confirmed: () => ({
    subject: "Appointment confirmed",
    introduction: "Your dental appointment has been confirmed.",
  }),
  rescheduled: () => ({
    subject: "Appointment rescheduled",
    introduction: "Your dental appointment schedule has been updated. The new details are shown below.",
  }),
  patientCancelled: () => ({
    subject: "Appointment cancellation acknowledged",
    introduction: "Your appointment cancellation has been recorded.",
  }),
  adminCancelled: () => ({
    subject: "Appointment cancelled by clinic",
    introduction: "Your appointment has been cancelled by the clinic. Please contact us if you need assistance.",
  }),
};

export function createAppointmentEmailService(config = env.email, transport = null) {
  let activeTransport = transport;
  return async function sendAppointmentEmail(event, appointment, recipientEmail) {
    if (!config.enabled) return { status: "disabled" };
    if (!recipientEmail) return { status: "skipped", reason: "missing-recipient" };
    const template = templates[event]?.(appointment);
    if (!template) throw new Error("Unsupported appointment email event");
    activeTransport ??= createSmtpTransport(config);
    const info = await activeTransport.sendMail({
      from: clinicSender(config),
      to: recipientEmail,
      subject: `${CLINIC_NAME}: ${template.subject}`,
      text: `Hello ${appointment.patientName},\n\n${template.introduction}\n\n${appointmentLines(appointment)}\n\n${CLINIC_NAME}`,
    });
    return { status: transport ? "test" : "sent", messageId: info.messageId };
  };
}

export const sendAppointmentEmail = createAppointmentEmailService();

export function createPasswordResetEmailService(config = env.email, transport = null) {
  let activeTransport = transport;
  return async function sendPasswordResetEmail({ recipientEmail, recipientName, resetUrl, expiresInMinutes }) {
    if (!config.enabled) return { status: "disabled" };
    if (!recipientEmail) return { status: "skipped", reason: "missing-recipient" };
    activeTransport ??= createSmtpTransport(config);
    const subject = `Reset Your Password - ${CLINIC_NAME}`;
    const text = [
      `Hello ${recipientName || "Patient"},`,
      "",
      "We received a request to reset your password.",
      "Open the link below to create a new password:",
      resetUrl,
      "",
      `This link will expire in ${expiresInMinutes} minutes.`,
      "If you did not request a password reset, you can safely ignore this email.",
      "",
      CLINIC_NAME,
    ].join("\n");
    const html = `<p>Hello ${escapeHtml(recipientName || "Patient")},</p>
      <p>We received a request to reset your password.</p>
      <p><a href="${escapeHtml(resetUrl)}">Reset Password</a></p>
      <p>This link will expire in ${expiresInMinutes} minutes.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p>${CLINIC_NAME}</p>`;
    const info = await activeTransport.sendMail({
      from: clinicSender(config),
      to: recipientEmail,
      subject,
      text,
      html,
    });
    return { status: transport ? "test" : "sent", messageId: info.messageId };
  };
}

export const sendPasswordResetEmail = createPasswordResetEmailService();

export function createVerificationEmailService(config = env.email, transport = null) {
  let activeTransport = transport;
  return async ({ recipientEmail, recipientName, verificationUrl, expiresInMinutes, purpose }) => {
    if (!config.enabled) return { status: "disabled" };
    activeTransport ??= createSmtpTransport(config);
    const introduction = purpose === "email_change" ? "Confirm your new email address. Your current email stays active until you confirm." : "Verify your email address to access your patient account.";
    const info = await activeTransport.sendMail({
      from: clinicSender(config), to: recipientEmail,
      subject: `Verify Your Email - ${CLINIC_NAME}`,
      text: `Hello ${recipientName},\n\n${introduction}\n${verificationUrl}\n\nThis link expires in ${expiresInMinutes} minutes and can be used once. If you did not request this, ignore this email.`,
      html: `<p>Hello ${escapeHtml(recipientName)},</p><p>${introduction}</p><p><a href="${escapeHtml(verificationUrl)}">Verify email</a></p><p>This link expires in ${expiresInMinutes} minutes and can be used once. If you did not request this, ignore this email.</p>`,
    });
    return { status: transport ? "test" : "sent", messageId: info.messageId };
  };
}
export const sendVerificationEmail = createVerificationEmailService();

export function createEmailChangedNotificationService(config = env.email, transport = null) {
  let activeTransport = transport;
  return async ({ recipientEmail }) => {
    if (!config.enabled) return { status: "disabled" };
    activeTransport ??= createSmtpTransport(config);
    const info = await activeTransport.sendMail({
      from: clinicSender(config), to: recipientEmail,
      subject: `Your Email Address Changed - ${CLINIC_NAME}`,
      text: `The email address for your patient account has been changed after verification. If you did not request this change, please contact ${CLINIC_NAME} immediately.`,
    });
    return { status: transport ? "test" : "sent", messageId: info.messageId };
  };
}
export const sendEmailChangedNotification = createEmailChangedNotificationService();
