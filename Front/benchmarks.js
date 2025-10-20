// benchmarks.js
// Carga y muestra los datos de benchmarks en las tablas

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('http://localhost:3000/api/benchmarks');
        const data = await res.json();
    // PIR vs MPU6050
    document.getElementById('pir-activaciones').textContent = data.activaciones.PIR;
    document.getElementById('mpu-activaciones').textContent = data.activaciones.MPU6050;
    // Alarma vs Email
    document.getElementById('alarma-velocidad').textContent = data.notificaciones.alarma + ' ms';
    document.getElementById('email-velocidad').textContent = data.notificaciones.email + ' ms';
    // Login MFA vs Login sin MFA
    document.getElementById('login-mfa-velocidad').textContent = data.autenticacion.mfa + ' ms';
    document.getElementById('login-simple-velocidad').textContent = data.autenticacion.simple + ' ms';
    // Registro de usuarios: MFA vs Sin MFA
    document.getElementById('registro-mfa').textContent = data.registro.mfa + ' ms';
    document.getElementById('registro-simple').textContent = data.registro.simple + ' ms';
    } catch (err) {
        console.error('Error cargando benchmarks:', err);
    }
});
