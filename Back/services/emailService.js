const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../../.env' });// Asegúrate de que las variables de entorno se carguen

// 1. Configurar el "transportador" de correo.
//    Lee las credenciales de tu archivo .env
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Refactor: Validar destinatario
function validateRecipient(recipientEmail) {
    if (!recipientEmail) {
        console.error('❌ No se proporcionó un destinatario para la alerta.');
        return false;
    }
    return true;
}

// Refactor: Construir opciones de correo
function buildMailOptions(recipientEmail, eventData) {
    const isMotion = eventData.event_type === 'motion_detected';
    const subject = `🚨 ¡Alerta de Seguridad! - ${isMotion ? 'Movimiento Detectado' : 'Vibración Detectada'}`;
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #c0392b;">Alerta de Seguridad del Sistema IoT</h2>
            <p>Se ha detectado un nuevo evento de seguridad en uno de tus dispositivos:</p>
            <ul style="list-style-type: none; padding: 0;">
                <li style="padding-bottom: 10px;"><strong>Tipo de Evento:</strong> ${isMotion ? 'Movimiento Confirmado' : 'Vibración Detectada'}</li>
                <li style="padding-bottom: 10px;"><strong>Sensor Activado:</strong> ${eventData.sensor_type}</li>
                <li style="padding-bottom: 10px;"><strong>Fecha y Hora:</strong> ${new Date(eventData.timestamp).toLocaleString('es-CL')}</li>
                <li style="padding-bottom: 10px;"><strong>ID del Dispositivo:</strong> ${eventData.device_id}</li>
            </ul>
            <p>Se recomienda revisar el dashboard para más detalles.</p>
            <hr>
            <small style="color: #7f8c8d;">Este es un mensaje automático generado por el Sistema de Alarma IoT.</small>
        </div>
    `;
    return {
        from: `"Sistema de Alarma IoT" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: subject,
        html: htmlBody,
    };
}

/**
 * Envía un correo electrónico de alerta de seguridad.
 * @param {string} recipientEmail - El correo del usuario a notificar.
 * @param {object} eventData - Los datos del evento (ej. { event_type, sensor_type, timestamp }).
 */
async function sendAlertEmail(recipientEmail, eventData) {
    try {
        if (!validateRecipient(recipientEmail)) return;
        const mailOptions = buildMailOptions(recipientEmail, eventData);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo de alerta enviado a ${recipientEmail}: ${info.messageId}`);
    } catch (error) {
        console.error('❌ Error enviando correo de alerta:', error);
    }
}

/**
 * Envía un correo con código de verificación MFA.
 * @param {string} recipientEmail - El correo del usuario.
 * @param {string} mfaCode - El código de verificación de 6 dígitos.
 */
async function sendMFACode(recipientEmail, mfaCode) {
    try {
        if (!validateRecipient(recipientEmail)) return;
        
        const mailOptions = {
            from: `"Sistema IoT" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: '🔐 Tu código de verificación - Sistema IoT',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center;">
                    <h2 style="color: #3498db;">Código de Verificación</h2>
                    <p>Tu código de verificación para el Sistema IoT es:</p>
                    <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h1 style="color: #3498db; letter-spacing: 5px; font-family: monospace;">${mfaCode}</h1>
                    </div>
                    <p style="color: #7f8c8d;">Este código expira en 5 minutos.</p>
                    <p style="color: #e74c3c; font-weight: bold;">No compartas este código con nadie.</p>
                    <hr>
                    <small style="color: #95a5a6;">Si no solicitaste este código, ignora este mensaje.</small>
                </div>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Código MFA enviado a ${recipientEmail}: ${info.messageId}`);
    } catch (error) {
        console.error('❌ Error enviando código MFA:', error);
    }
}

module.exports = { sendAlertEmail, sendMFACode };

