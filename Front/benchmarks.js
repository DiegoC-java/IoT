// benchmarks.js
// Carga y muestra los datos de benchmarks en las tablas

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('http://localhost:3000/api/auth/benchmarks');
        const data = await res.json();
        // Login MFA vs Login sin MFA
        document.getElementById('login-mfa-velocidad').textContent = (data.loginMfa !== null ? data.loginMfa + ' ms' : 'N/A');
        document.getElementById('login-simple-velocidad').textContent = (data.loginSimple !== null ? data.loginSimple + ' ms' : 'N/A');
    } catch (err) {
        console.error('Error cargando benchmarks:', err);
    }
});
