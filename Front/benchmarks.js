// API Base URL
const API_URL = 'http://localhost:3000/api';

// Elementos del DOM
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');

/**
 * Obtiene los benchmarks del servidor
 */
async function loadBenchmarks() {
    try {
        if (loadingDiv) loadingDiv.style.display = 'block';
        if (errorDiv) errorDiv.style.display = 'none';

        const response = await fetch(`${API_URL}/benchmarks/stats`);
        
        if (!response.ok) {
            throw new Error('Error al obtener benchmarks');
        }

        const data = await response.json();
        console.log('📊 Benchmarks recibidos:', data);

        if (data.success) {
            renderBenchmarks(data.data);
            updateLastUpdateTime();
        } else {
            throw new Error(data.message || 'Error desconocido');
        }
    } catch (error) {
        console.error('❌ Error cargando benchmarks:', error);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = `<p>❌ Error: ${error.message}</p>`;
        }
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}

/**
 * Renderiza los benchmarks en el HTML
 */
function renderBenchmarks(stats) {
    try {
        // ========== BENCHMARK 1: LOGIN ==========
        const loginData = stats.login || {};
        
        // Login sin MFA
        const sinMFA = loginData.withoutMFA || { avg_time: 0, total: 0 };
        const elem1 = document.getElementById('login-sin-mfa-time');
        const elem2 = document.getElementById('login-sin-mfa-count');
        if (elem1) elem1.textContent = `${Math.round(sinMFA.avg_time)} ms`;
        if (elem2) elem2.textContent = sinMFA.total || 0;

        // Login con MFA
        const conMFA = loginData.withMFA || { avg_time: 0, total: 0 };
        const elem3 = document.getElementById('login-con-mfa-time');
        const elem4 = document.getElementById('login-con-mfa-count');
        if (elem3) elem3.textContent = `${Math.round(conMFA.avg_time)} ms`;
        if (elem4) elem4.textContent = conMFA.total || 0;

        // ========== BENCHMARK 2: FALSOS POSITIVOS ==========
        const falsePositives = stats.falsePositives || {};
        
        // PIR
        const pirData = falsePositives.PIR || { false_count: 0, total: 0, percentage: 0 };
        const elem5 = document.getElementById('pir-total');
        const elem6 = document.getElementById('pir-false');
        const elem7 = document.getElementById('pir-percentage');
        if (elem5) elem5.textContent = pirData.total || 0;
        if (elem6) elem6.textContent = pirData.false_count || 0;
        if (elem7) {
            const pirPercentage = parseFloat(pirData.percentage) || 0;
            elem7.innerHTML = `
                <span style="color: ${pirPercentage > 10 ? '#e74c3c' : '#27ae60'};">
                    ${pirPercentage.toFixed(2)}%
                </span>
            `;
        }

        // MPU6050
        const mpuData = falsePositives.MPU6050 || { false_count: 0, total: 0, percentage: 0 };
        const elem8 = document.getElementById('mpu-total');
        const elem9 = document.getElementById('mpu-false');
        const elem10 = document.getElementById('mpu-percentage');
        if (elem8) elem8.textContent = mpuData.total || 0;
        if (elem9) elem9.textContent = mpuData.false_count || 0;
        if (elem10) {
            const mpuPercentage = parseFloat(mpuData.percentage) || 0;
            elem10.innerHTML = `
                <span style="color: ${mpuPercentage > 10 ? '#e74c3c' : '#27ae60'};">
                    ${mpuPercentage.toFixed(2)}%
                </span>
            `;
        }

        // ========== BENCHMARK 3: EMAIL Y DASHBOARD ==========
        const emailData = stats.email || { avg_time: 0, total: 0 };
        const elem11 = document.getElementById('email-time');
        const elem12 = document.getElementById('email-count');
        if (elem11) elem11.textContent = `${Math.round(emailData.avg_time)} ms`;
        if (elem12) elem12.textContent = emailData.total || 0;

        // Dashboard latency
        const dashboardData = stats.dashboardLatency || { avg_latency: 0, total: 0 };
        const elem13 = document.getElementById('dashboard-latency');
        const elem14 = document.getElementById('dashboard-count');
        if (elem13) elem13.textContent = `${Math.round(dashboardData.avg_latency)} ms`;
        if (elem14) elem14.textContent = dashboardData.total || 0;

        console.log('✅ Benchmarks renderizados correctamente');
    } catch (error) {
        console.error('❌ Error renderizando benchmarks:', error);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = `<p>❌ Error renderizando datos</p>`;
        }
    }
}

/**
 * Actualiza la hora de última actualización
 */
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    updateBenchmarkHeaderLastUpdate(now);
}

/**
 * Marca un evento como real o falso positivo
 */
async function markEventAsFalsePositive(eventId, isFalse) {
    try {
        const response = await fetch(`${API_URL}/benchmarks/event/${eventId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_false_positive: isFalse
            })
        });

        if (!response.ok) {
            throw new Error('Error al actualizar evento');
        }

        console.log(`✅ Evento ${eventId} marcado como ${isFalse ? 'falso positivo' : 'real'}`);
        
        // Recargar benchmarks después de marcar
        setTimeout(loadBenchmarks, 500);
    } catch (error) {
        console.error('❌ Error marcando evento:', error);
    }
}

// ========== EVENT LISTENERS ==========

// Cargar benchmarks al iniciar
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Inicializando página de benchmarks...');
    initializeBenchmarkChrome();
    loadBenchmarks();
    
    // Actualizar cada 30 segundos automáticamente
    setInterval(loadBenchmarks, 30000);
});

// Exportar función para usar desde otras páginas si es necesario
window.benchmarkModule = {
    loadBenchmarks,
    markEventAsFalsePositive
};

function updateBenchmarkHeaderLastUpdate(date) {
    const chip = document.getElementById('pageLastUpdate');
    if (!chip) return;
    chip.innerHTML = `<i class="fas fa-clock"></i> Última actualización: ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function initializeBenchmarkChrome() {
    updateBenchmarkDateTime();
    setInterval(updateBenchmarkDateTime, 60000);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('iot_user');
            localStorage.removeItem('iot_login_time');
            window.location.href = 'login.html';
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('🔄 Actualizando benchmarks...');
            loadBenchmarks();
        });
    }

}

function updateBenchmarkDateTime() {
    const chip = document.getElementById('pageDateTime');
    if (!chip) return;
    const now = new Date();
    chip.textContent = now.toLocaleString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
