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
        
        // PASO 1: Intentar login
        const backendAuth = await authenticateWithBackend(username, password);
        
        // PASO 2: Si el backend requiere MFA, mostrar campo
        if (backendAuth.mfaRequired) {
            console.log('🔐 MFA requerido, mostrando campo de código...');
            console.log('Buscando elemento mfaGroup...');
            const mfaGroup = document.getElementById('mfaGroup');
            console.log('Elemento encontrado:', mfaGroup);
            
            if (!mfaGroup) {
                console.error('❌ ERROR: No se encontró elemento mfaGroup en el DOM');
                showAlert('Error: Campo MFA no encontrado en la página', 'error');
                setLoadingState(false);
                return;
            }
            
            showAlert('Se envió un código de autenticación a tu correo', 'info');
            mfaGroup.style.display = 'block';
            console.log('mfaGroup display:', mfaGroup.style.display);
            
            window.mfaEmail = backendAuth.email;
            window.mfaUsername = username;
            window.mfaRememberMe = rememberMe;
            
            // Cambiar el botón para MFA
            const loginBtn = document.getElementById('loginBtn');
            if (!loginBtn) {
                console.error('❌ ERROR: No se encontró botón loginBtn');
                setLoadingState(false);
                return;
            }
            
            // Remover el event listener del formulario temporalmente
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.onsubmit = function(ev) {
                    ev.preventDefault();
                    handleMfaLogin(username, rememberMe);
                    return false;
                };
            }
            
            loginBtn.type = 'button';
            loginBtn.textContent = 'Validar código';
            loginBtn.onclick = async function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                await handleMfaLogin(username, rememberMe);
            };
            
            // Cambiar el foco al campo de código
            setTimeout(() => {
                const mfaCode = document.getElementById('mfaCode');
                if (mfaCode) {
                    mfaCode.focus();
                    console.log('✅ Focus en mfaCode');
                } else {
                    console.error('❌ ERROR: No se encontró campo mfaCode');
                }
            }, 100);
            
            setLoadingState(false);
            return;
        }
        
        if (!backendAuth.success) {
            console.log('⚠️ Backend falló, intentando autenticación local...');
            const localAuth = authenticateLocally(username, password);
            if (!localAuth.success) {
                showAlert('Usuario o contraseña incorrectos', 'error');
                shakeLoginCard();
                setLoadingState(false);
                return;
            }
            backendAuth.user = localAuth.user;
            backendAuth.success = true;
        }
        
        // PASO 3: Login exitoso sin MFA
        console.log('✅ Autenticación exitosa sin MFA');
        await handleSuccessfulLogin(backendAuth.user, rememberMe);
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        showAlert('Error de conexión. Usando autenticación local.', 'error');
        
        // Fallback a autenticación local
        const localAuth = authenticateLocally(usernameInput.value.trim(), passwordInput.value);
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
        console.log('URL:', 'http://localhost:3000/api/auth/login');
        console.log('Datos:', { username, password });
        
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
            timeout: 5000
        });
        
        console.log('Status HTTP:', response.status);
        console.log('Response.ok:', response.ok);
        
        if (response.ok) {
            const result = await response.json();
            console.log('📡 Respuesta COMPLETA del backend:', result);
            console.log('¿mfaRequired?:', result.mfaRequired);
            console.log('¿success?:', result.success);
            console.log('¿email?:', result.email);
            
            // Si el backend requiere MFA
            if (result.mfaRequired) {
                console.log('✅ DETECTADO: MFA requerido');
                return {
                    success: false,
                    mfaRequired: true,
                    email: result.email,
                    username: username
                };
            }
            
            // Si el login fue exitoso (sin MFA)
            if (result.success) {
                console.log('✅ DETECTADO: Login exitoso sin MFA');
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
        
        console.log('❌ Backend retornó algo que no es 2xx o no tiene flags esperados');
        return { success: false };
    } catch (error) {
        console.log('❌ Error conectando con backend:', error.message);
        console.log('Stack:', error.stack);
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
    
    // Restaurar formulario a estado original
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    
    if (loginForm) {
        loginForm.onsubmit = handleLogin;
    }
    
    if (loginBtn) {
        loginBtn.type = 'submit';
        loginBtn.textContent = 'Iniciar Sesión';
        loginBtn.style.background = 'var(--success-color)';
        loginBtn.onclick = null;
    }
    
    // Ocultar campo MFA si estaba visible
    const mfaGroup = document.getElementById('mfaGroup');
    if (mfaGroup) {
        mfaGroup.style.display = 'none';
    }
    
    // Redirigir después de un breve delay
    setTimeout(() => {
        redirectToDashboard();
    }, 1500);
}

// Manejar validación de código MFA
async function handleMfaLogin(username, rememberMe) {
    const mfaCodeInput = document.getElementById('mfaCode');
    const mfaCode = mfaCodeInput ? mfaCodeInput.value.trim() : '';
    const email = window.mfaEmail;
    
    if (!mfaCode) {
        showAlert('Por favor ingresa el código de autenticación', 'error');
        return;
    }
    
    if (!email) {
        showAlert('Error: email no disponible', 'error');
        return;
    }
    
    setLoadingState(true);
    
    try {
        console.log('🔐 Validando código MFA...');
        const response = await fetch('http://localhost:3000/api/auth/verify-mfa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, code: mfaCode })
        });
        
        if (!response.ok) {
            const error = await response.json();
            showAlert(error.message || 'Código incorrecto', 'error');
            mfaCodeInput.value = '';
            mfaCodeInput.focus();
            setLoadingState(false);
            return;
        }
        
        const result = await response.json();
        if (result.success) {
            console.log('✅ Código MFA válido, login completado');
            // Construir objeto usuario desde la respuesta
            const user = {
                username: result.user.username,
                role: result.user.role,
                loginMethod: 'backend'
            };
            await handleSuccessfulLogin(user, rememberMe);
        } else {
            showAlert(result.message || 'Error validando código', 'error');
            setLoadingState(false);
        }
    } catch (error) {
        console.error('❌ Error validando MFA:', error);
        showAlert('Error validando código', 'error');
        setLoadingState(false);
    }
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