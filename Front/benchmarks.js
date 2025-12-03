// API Base URL
const API_URL = 'http://localhost:3000/api';


const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const lastUpdateSpan = document.getElementById('last-update');
const refreshBtn = document.getElementById('refresh-btn');


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


// Renderiza los benchmarks en el HTML

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

        // ========== BENCHMARK 3: EMAIL ==========
        const emailData = stats.email || { avg_time: 0, total: 0 };
        const elem11 = document.getElementById('email-time');
        const elem12 = document.getElementById('email-count');
        if (elem11) elem11.textContent = `${Math.round(emailData.avg_time)} ms`;
        if (elem12) elem12.textContent = emailData.total || 0;

        console.log('✅ Benchmarks renderizados correctamente');
    } catch (error) {
        console.error('❌ Error renderizando benchmarks:', error);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = `<p>❌ Error renderizando datos</p>`;
        }
    }
}

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
    if (lastUpdateSpan) lastUpdateSpan.textContent = timeString;
}


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
        
        setTimeout(loadBenchmarks, 500);
    } catch (error) {
        console.error('❌ Error marcando evento:', error);
    }
}


// Botón actualizar
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        console.log('🔄 Actualizando benchmarks...');
        loadBenchmarks();
    });
}


// Función para mostrar modal de confirmación bonito

function showConfirmModal(title, message, onConfirm) {
    return new Promise((resolve) => {

        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h2>${title}</h2>
                </div>
                <p class="modal-message">${message}</p>
                <div class="modal-actions">
                    <button class="btn-modal btn-cancel">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-modal btn-confirm">
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                </div>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const cancelBtn = modal.querySelector('.btn-cancel');
        const confirmBtn = modal.querySelector('.btn-confirm');
        
        const close = () => {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 300);
        };
        
        cancelBtn.addEventListener('click', () => {
            close();
            resolve(false);
        });
        
        confirmBtn.addEventListener('click', () => {
            close();
            resolve(true);
        });
        
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEsc);
                close();
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        setTimeout(() => overlay.classList.add('active'), 10);
    });
}

// Botón limpiar TODOS los datos

const clearAllBtn = document.getElementById('clear-all-btn');
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmModal(
            'Eliminar Todos los Datos',
            '¿Deseas eliminar TODOS los datos registrados? Esta acción es IRREVERSIBLE y no se puede deshacer.'
        );
        
        if (!confirmed) return;

        clearAllBtn.classList.add('loading');
        clearAllBtn.disabled = true;

        try {
            console.log('🗑️  Enviando solicitud para eliminar todo...');
            const response = await fetch(`${API_URL}/dashboard/clear-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataType: 'all' })
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();
            console.log('🗑️  Respuesta del servidor:', data);
            
            if (data.success) {
                console.log('✅ Todos los datos han sido eliminados correctamente');
                clearAllBtn.classList.remove('loading');
                clearAllBtn.classList.add('success');
                clearAllBtn.querySelector('.btn-text').textContent = '✅ Datos Eliminados';
                
                setTimeout(() => {
                    clearAllBtn.classList.remove('success');
                    clearAllBtn.disabled = false;
                    clearAllBtn.querySelector('.btn-text').textContent = 'Limpiar Datos';
                    loadBenchmarks();
                }, 2000);
            } else {
                throw new Error(data.message || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error eliminando todos los datos:', error);
            clearAllBtn.classList.remove('loading');
            clearAllBtn.classList.add('error');
            clearAllBtn.querySelector('.btn-text').textContent = '❌ Error';
            
            setTimeout(() => {
                clearAllBtn.classList.remove('error');
                clearAllBtn.disabled = false;
                clearAllBtn.querySelector('.btn-text').textContent = 'Limpiar Datos';
            }, 2000);
        }
    });
}

// Cargar benchmarks al iniciar
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Inicializando página de benchmarks...');
    loadBenchmarks();
    
    // Actualizar cada 30 segundos automáticamente
    setInterval(loadBenchmarks, 30000);
});


window.benchmarkModule = {
    loadBenchmarks,
    markEventAsFalsePositive
};
