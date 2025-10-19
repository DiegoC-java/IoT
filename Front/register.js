document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const alertBox = document.getElementById('alert');
    const alertMsg = alertBox.querySelector('.alert-message');
    alertBox.style.display = 'none';

    if (!username || !email || !password) {
        alertMsg.textContent = 'Todos los campos son obligatorios.';
        alertBox.style.display = 'block';
        return;
    }

    document.getElementById('registerBtn').disabled = true;
    try {
        const res = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alertMsg.textContent = '¡Registro exitoso! Ahora puedes iniciar sesión.';
            alertBox.classList.remove('alert-error');
            alertBox.classList.add('alert-success');
            alertBox.style.display = 'block';
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else {
            alertMsg.textContent = data.message || 'Error al registrar.';
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
    document.getElementById('registerBtn').disabled = false;
});

// Mostrar/ocultar contraseña
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
