document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const registerType = document.querySelector('input[name="registerType"]:checked').value;
    const alertBox = document.getElementById('alert');
    const alertMsg = alertBox.querySelector('.alert-message');
    alertBox.style.display = 'none';

    if (!username || !email || !password) {
        alertMsg.textContent = 'Todos los campos son obligatorios.';
        alertBox.style.display = 'block';
        return;
    }
    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    try {
        const res = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, registerType })
        });
        const data = await res.json();
        if (res.ok && data.mfaRequired) {
            // Mostrar campo MFA y botón de verificación
            document.getElementById('mfaGroup').style.display = 'block';
            registerBtn.style.display = 'none';
            let extra = '';
            if (data.registerTimeMs !== undefined && data.mailTimeMs !== undefined) {
                extra = `\nTiempo de registro: ${data.registerTimeMs} ms\nTiempo en enviar correo: ${data.mailTimeMs} ms`;
            }
            alertMsg.textContent = 'Se envió un código de verificación al correo. Ingresa el código para activar tu cuenta.' + extra;
            alertBox.classList.remove('alert-error');
            alertBox.classList.add('alert-success');
            alertBox.style.display = 'block';
            // Guardar email para verificación
            window._registerEmail = email;
            // Si el registro es con MFA, redirigir al login tras activar usuario (ver abajo)
        } else {
            if (data.success) {
                alertMsg.textContent = '¡Usuario registrado exitosamente! Ahora puedes iniciar sesión.';
                alertBox.classList.remove('alert-error');
                alertBox.classList.add('alert-success');
                alertBox.style.display = 'block';
                setTimeout(() => window.location.href = 'login.html', 1500);
            } else {
                alertMsg.textContent = data.message || 'Error al registrar.';
                alertBox.classList.remove('alert-success');
                alertBox.classList.add('alert-error');
                alertBox.style.display = 'block';
            }
        }
    } catch (err) {
        alertMsg.textContent = 'Error de conexión con el servidor.';
        alertBox.classList.remove('alert-success');
        alertBox.classList.add('alert-error');
        alertBox.style.display = 'block';
    }
    // No volver a habilitar el botón hasta que el usuario termine el proceso MFA
// Verificar código MFA y activar usuario
document.getElementById('verifyMfaBtn').addEventListener('click', async function() {
    const mfaCode = document.getElementById('mfaCode').value.trim();
    const email = window._registerEmail;
    const alertBox = document.getElementById('alert');
    const alertMsg = alertBox.querySelector('.alert-message');
    if (!mfaCode || !email) {
        alertMsg.textContent = 'Debes ingresar el código enviado al correo.';
        alertBox.classList.remove('alert-success');
        alertBox.classList.add('alert-error');
        alertBox.style.display = 'block';
        return;
    }
    this.disabled = true;
    try {
        const res = await fetch('http://localhost:3000/api/auth/verify-mfa-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: mfaCode })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alertMsg.textContent = '¡Usuario activado exitosamente! Ahora puedes iniciar sesión.';
            alertBox.classList.remove('alert-error');
            alertBox.classList.add('alert-success');
            alertBox.style.display = 'block';
            setTimeout(() => window.location.href = 'login.html', 1500);
        } else {
            alertMsg.textContent = data.message || 'Error al activar usuario.';
            alertBox.classList.remove('alert-success');
            alertBox.classList.add('alert-error');
            alertBox.style.display = 'block';
        }
    } catch (err) {
        alertMsg.textContent = 'Error de conexión con el servidor.';
        alertBox.classList.remove('alert-success');
        alertBox.classList.add('alert-error');
        alertBox.style.display = 'block';
    }
    this.disabled = false;
});
    // Eliminado: doble fetch innecesario que causaba doble envío de código
});

// Mostrar/ocultar contraseña
// Cambiar visual según tipo de registro
document.querySelectorAll('input[name="registerType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        // Guardar la opción seleccionada en localStorage antes de recargar
        localStorage.setItem('registerTypeSelected', this.value);
        window.location.reload();
    });
});
// Al cargar la página, restaurar la opción seleccionada si existe
window.addEventListener('DOMContentLoaded', () => {
    const selected = localStorage.getItem('registerTypeSelected');
    if (selected) {
        const radio = document.querySelector(`input[name="registerType"][value="${selected}"]`);
        if (radio) radio.checked = true;
        localStorage.removeItem('registerTypeSelected');
    }
});
const togglePassword = document.getElementById('togglePassword');
togglePassword.addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    const icon = this.querySelector('i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
});
