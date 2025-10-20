const nodemailer = require('nodemailer');
require('dotenv').config(); // Asegúrate de que las variables de entorno se carguen

// 1. Configurar el "transportador" de correo.
//    Lee las credenciales de tu archivo .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true para el puerto 465 (SSL)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Esta debe ser tu contraseña de aplicación de Google
    },
});

/**
 * Envía un correo electrónico de alerta de seguridad.
 * @param {string} recipientEmail - El correo del usuario a notificar.
 * @param {object} eventData - Los datos del evento (ej. { event_type, sensor_type, timestamp }).
 */
async function sendAlertEmail(recipientEmail, eventData) {
    try {
        if (!recipientEmail) {
            console.error('❌ No se proporcionó un destinatario para la alerta.');
            return;
        }

        // Determina el asunto y el cuerpo del correo según el tipo de evento
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

        const mailOptions = {
            from: `"Sistema de Alarma IoT" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: subject,
            html: htmlBody,
        };

        // Enviar el correo
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo de alerta enviado a ${recipientEmail}: ${info.messageId}`);

    } catch (error) {
        console.error('❌ Error enviando correo de alerta:', error);
    }
}

module.exports = { sendAlertEmail };

