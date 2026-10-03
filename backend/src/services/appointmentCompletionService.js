import * as appointments from '../models/appointmentModel.js';
import { writeAudit } from './auditService.js';
import { AppError } from '../utils/AppError.js';

// Caller owns the appointment row lock and the clinical-record transaction.
export async function completeTreatmentAppointment(connection, appointment, userId, ipAddress) {
  if (appointment.status === 'Completed') return;
  if (appointment.status !== 'Confirmed') {
    throw new AppError('Only a confirmed appointment can be completed by recording treatment.', 409, 'INVALID_APPOINTMENT_STATUS');
  }
  await appointments.updateStatus(connection, appointment.id, 'Completed');
  await appointments.insertHistory(connection, {
    id: appointment.id, action: 'Completed', previousStatus: appointment.status,
    newStatus: 'Completed', userId,
  });
  await writeAudit({ userId, eventType: 'APPOINTMENT_COMPLETED', outcome: 'Success', ipAddress,
    metadata: { appointmentId: appointment.appointment_id, source: 'completed_treatment' } }, connection);
}
