// Variables globales
let isLoading = false;

// Usuarios válidos para autenticación local (fallback)
const validUsers = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'user', password: 'user123', role: 'user' },
    { username: 'demo', password: 'demo123', role: 'demo' }
];

// Inicialización cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Iniciando sistema de login...');
    
    // Verificar si ya hay una sesión activa
    checkExistingSession();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar credenciales guardadas
    loadSavedCredentials();
    
    // Enfocar el campo de usuario
    setTimeout(() => {
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.focus();
    }, 100);
});

// Verificar si ya existe una sesión activa
function checkExistingSession() {
    const currentUser = localStorage.getItem('iot_user');
    const loginTime = localStorage.getItem('iot_login_time');
    
    if (currentUser && loginTime) {
        const now = new Date().getTime();
        const sessionTime = parseInt(loginTime);
        const sessionDuration = 24 * 60 * 60 * 1000; // 24 horas
        
        if (now - sessionTime < sessionDuration) {
            console.log('✅ Sesión activa encontrada, redirigiendo...');
            redirectToDashboard();
            return true;
        } else {
            console.log('⏰ Sesión expirada, limpiando...');
            clearSession();
        }
    }
    return false;
}

// Configurar event listeners
function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const forgotPasswordLink = document.getElementById('forgotPassword');

    // Submit del formulario
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Toggle de contraseña
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    }

    // Navegación con Enter
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && usernameInput.value.trim()) {
                e.preventDefault();
                passwordInput.focus();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && passwordInput.value) {
                e.preventDefault();
                handleLogin(e);
            }
        });
    }

    // Limpiar alertas cuando el usuario empiece a escribir
    if (usernameInput) {
        usernameInput.addEventListener('input', clearAlert);
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', clearAlert);
    }

    // Forgot password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            showAlert('Contacta al administrador para restablecer tu contraseña', 'info');
        });
    }
}

// Manejar el login
async function handleLogin(e) {
    e.preventDefault();
    
    if (isLoading) return;
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
    
    // Validaciones básicas
    if (!username || !password) {
        showAlert('Por favor, completa todos los campos', 'error');
        return;
    }
    
    if (username.length < 3) {
        showAlert('El usuario debe tener al menos 3 caracteres', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    setLoadingState(true);
    
    try {
        console.log('🔐 Intentando autenticación...');
        
        // Intentar autenticación con el backend primero
        const backendAuth = await authenticateWithBackend(username, password);
        
        if (backendAuth.success) {
            console.log('✅ Autenticación exitosa con backend');
            await handleSuccessfulLogin(backendAuth.user, rememberMe);
        } else {
            console.log('⚠️ Backend falló, intentando autenticación local...');
            // Fallback a autenticación local
            const localAuth = authenticateLocally(username, password);
            
            if (localAuth.success) {
                console.log('✅ Autenticación exitosa local');
                await handleSuccessfulLogin(localAuth.user, rememberMe);
            } else {
                showAlert('Usuario o contraseña incorrectos', 'error');
                shakeLoginCard();
            }
        }
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        showAlert('Error de conexión. Usando autenticación local.', 'error');
        
        // Fallback a autenticación local
        const localAuth = authenticateLocally(username, password);
        if (localAuth.success) {
            await handleSuccessfulLogin(localAuth.user, rememberMe);
        } else {
            showAlert('Usuario o contraseña incorrectos', 'error');
            shakeLoginCard();
        }
    } finally {
        setLoadingState(false);
    }
}

// Autenticar con el backend
async function authenticateWithBackend(username, password) {
    try {
        console.log('🌐 Conectando con backend...');
        
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
            timeout: 5000
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('📡 Respuesta del backend:', result);
            
            if (result.success) {
                return {
                    success: true,
                    user: {
                        username: result.user.username,
                        role: result.user.role,
                        loginMethod: 'backend'
                    }
                };
            }
        }
        
        console.log('❌ Backend retornó error');
        return { success: false };
        
    } catch (error) {
        console.log('❌ Error conectando con backend:', error.message);
        return { success: false };
    }
}

// Autenticación local (fallback)
function authenticateLocally(username, password) {
    console.log('🔍 Buscando en usuarios locales...');
    
    const user = validUsers.find(u => u.username === username && u.password === password);
    
    if (user) {
        return {
            success: true,
            user: {
                username: user.username,
                role: user.role,
                loginMethod: 'local'
            }
        };
    }
    
    return { success: false };
}

// Manejar login exitoso
async function handleSuccessfulLogin(user, rememberMe) {
    console.log('🎉 Login exitoso:', user);
    
    // Guardar información de la sesión
    const sessionData = {
        username: user.username,
        role: user.role,
        loginTime: new Date().getTime(),
        loginMethod: user.loginMethod || 'backend'
    };
    
    localStorage.setItem('iot_user', JSON.stringify(sessionData));
    localStorage.setItem('iot_login_time', sessionData.loginTime.toString());
    
    // Guardar credenciales si se solicitó
    if (rememberMe) {
        localStorage.setItem('iot_remember_user', user.username);
    } else {
        localStorage.removeItem('iot_remember_user');
    }
    
    // Mostrar mensaje de éxito
    showAlert(`¡Bienvenido, ${user.username}!`, 'success');
    
    // Cambiar color del botón
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.style.background = 'var(--success-color)';
    }
    
    // Redirigir después de un breve delay
    setTimeout(() => {
        redirectToDashboard();
    }, 1500);
}

// Redirigir al dashboard
function redirectToDashboard() {
    console.log('🚀 Redirigiendo al dashboard...');
    
    // Efecto de transición
    document.body.style.transition = 'opacity 0.3s ease-out';
    document.body.style.opacity = '0';
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 300);
}

// Toggle de visibilidad de contraseña
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('#togglePassword i');
    
    if (!passwordInput || !toggleIcon) return;
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
    
    // Mantener el foco
    passwordInput.focus();
}

// Mostrar/ocultar estado de carga
function setLoadingState(loading) {
    isLoading = loading;
    
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnSpinner = loginBtn.querySelector('.btn-spinner');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (loading) {
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'block';
        if (usernameInput) usernameInput.disabled = true;
        if (passwordInput) passwordInput.disabled = true;
    } else {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (usernameInput) usernameInput.disabled = false;
        if (passwordInput) passwordInput.disabled = false;
    }
}

// Mostrar alerta
function showAlert(message, type = 'error') {
    const alert = document.getElementById('alert');
    const alertMessage = document.querySelector('.alert-message');
    
    if (!alert || !alertMessage) return;
    
    alertMessage.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'flex';
    
    // Auto-ocultar después de 5 segundos
    setTimeout(clearAlert, 5000);
}

// Limpiar alerta
function clearAlert() {
    const alert = document.getElementById('alert');
    if (alert) {
        alert.style.display = 'none';
    }
}

// Animación de error en la tarjeta
function shakeLoginCard() {
    const card = document.querySelector('.login-card');
    if (card) {
        card.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            card.style.animation = '';
        }, 500);
    }
}

// Cargar credenciales guardadas
function loadSavedCredentials() {
    const savedUser = localStorage.getItem('iot_remember_user');
    const usernameInput = document.getElementById('username');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const passwordInput = document.getElementById('password');
    
    if (savedUser && usernameInput) {
        usernameInput.value = savedUser;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
        if (passwordInput) passwordInput.focus();
    }
}

// Limpiar sesión
function clearSession() {
    localStorage.removeItem('iot_user');
    localStorage.removeItem('iot_login_time');
}

// Función de logout (para uso global)
function logout() {
    clearSession();
    localStorage.removeItem('iot_remember_user');
    window.location.href = 'login.html';
}

// Exportar función logout para uso global
window.logout = logout;

// Agregar estilos dinámicos para animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    .alert.info {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
    }
`;
document.head.appendChild(style);