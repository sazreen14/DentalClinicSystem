const OFFICIAL_WHATSAPP_BOOKING_NUMBER = "60192817109";

export function buildWhatsAppBookingUrl(clinicInfo) {
  const message = `Hi ${clinicInfo?.clinicName || "Klinik Pergigian Rosni Adam"}, I would like to make a dental appointment.`;
  return `https://wa.me/${OFFICIAL_WHATSAPP_BOOKING_NUMBER}?text=${encodeURIComponent(message)}`;
}
