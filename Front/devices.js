const API_BASE_URL = 'http://localhost:3000/api';
const DEFAULT_LIMIT = 10;
let currentLimit = DEFAULT_LIMIT;
let isLoadingAlerts = false;
let currentAlertsData = []; // Para almacenar los datos actuales

document.addEventListener('DOMContentLoaded', () => {
    initializePageChrome();
    setupAlertControls();
    fetchAndRenderAlerts();
});

function setupAlertControls() {
    const limitSelect = document.getElementById('alertsLimit');
    const refreshBtn = document.getElementById('refreshAlertsBtn');
    const headerRefreshBtn = document.getElementById('pageRefreshBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');

    if (limitSelect) {
        limitSelect.value = DEFAULT_LIMIT.toString();
        limitSelect.addEventListener('change', () => {
            currentLimit = parseInt(limitSelect.value, 10) || DEFAULT_LIMIT;
            fetchAndRenderAlerts();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchAndRenderAlerts);
    }
    if (headerRefreshBtn) {
        headerRefreshBtn.addEventListener('click', fetchAndRenderAlerts);
    }
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
}

async function fetchAndRenderAlerts() {
    if (isLoadingAlerts) return;
    isLoadingAlerts = true;
    toggleRefreshState(true);

    try {
        const response = await fetch(`${API_BASE_URL}/events/history?limit=${currentLimit}`);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const result = await response.json();
        const alerts = Array.isArray(result.data) ? result.data : [];
        currentAlertsData = alerts; // Guardar los datos para exportación
        renderAlerts(alerts);
        showEmptyState(alerts.length === 0 ? 'Sin alertas registradas en este rango.' : '');
        updateAlertsLastUpdate();
    } catch (error) {
        console.error('Error cargando historial de alertas:', error);
        currentAlertsData = [];
        renderAlerts([]);
        showEmptyState('No se pudo cargar el historial. Intenta nuevamente.');
    } finally {
        toggleRefreshState(false);
        isLoadingAlerts = false;
    }
}

function renderAlerts(alerts) {
    const tbody = document.getElementById('alertsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    alerts.forEach((alert, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <span class="event-badge ${getEventClass(alert.event_type)}">
                    ${getEventLabel(alert.event_type)}
                </span>
            </td>
            <td>${alert.device_id || '—'}</td>
            <td>${formatSensorType(alert.sensor_type)}</td>
            <td>${formatSensorValue(alert.sensor_value)}</td>
            <td>${formatDateTime(alert.timestamp)}</td>
            <td>${formatRelativeTime(alert.timestamp)}</td>
        `;
        tbody.appendChild(row);
    });
}

function toggleRefreshState(isLoading) {
    const refreshBtn = document.getElementById('refreshAlertsBtn');
    const headerRefreshBtn = document.getElementById('pageRefreshBtn');
    if (refreshBtn) {
        refreshBtn.disabled = isLoading;
        refreshBtn.classList.toggle('is-loading', isLoading);
    }
    if (headerRefreshBtn) {
        headerRefreshBtn.disabled = isLoading;
        headerRefreshBtn.classList.toggle('is-loading', isLoading);
    }
}

function showEmptyState(message) {
    const emptyState = document.getElementById('alertsEmptyState');
    if (!emptyState) return;

    if (!message) {
        emptyState.classList.remove('visible');
        return;
    }

    const text = emptyState.querySelector('p');
    if (text) {
        text.textContent = message;
    }
    emptyState.classList.add('visible');
}

function updateAlertsLastUpdate() {
    const indicator = document.getElementById('alertsLastUpdate');
    const now = new Date();
    if (indicator) {
        indicator.innerHTML = `<i class="fas fa-clock"></i> Actualizado ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
    updateHeaderLastUpdate(now);
}

function getEventLabel(type = '') {
    const map = {
        motion_detected: 'Movimiento detectado',
        vibration_detected: 'Vibración detectada',
        alarma_activada: 'Alarma activada',
        alarma_desactivada: 'Alarma desactivada'
    };
    return map[type] || type || 'Evento';
}

function getEventClass(type = '') {
    const classes = {
        motion_detected: 'event-motion',
        vibration_detected: 'event-vibration',
        alarma_activada: 'event-alarm',
        alarma_desactivada: 'event-info'
    };
    return classes[type] || 'event-generic';
}

function formatSensorType(type = '') {
    if (!type) return '—';
    const map = {
        pir: 'PIR / Movimiento',
        mpu6050: 'MPU6050 / Vibración',
        temperatura: 'Temperatura',
        humedad: 'Humedad'
    };
    return map[type.toLowerCase()] || type;
}

function formatSensorValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value.toFixed(2);
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
        return Number.isInteger(parsed) ? parsed : parsed.toFixed(2);
    }
    return value;
}

function formatDateTime(value) {
    if (!value) return 'Sin registros';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatRelativeTime(value) {
    if (!value) return 'Sin registros';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin registros';
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
}

function initializePageChrome() {
    updatePageDateTime();
    setInterval(updatePageDateTime, 60000);

    const logoutBtn = document.getElementById('pageLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('iot_user');
            localStorage.removeItem('iot_login_time');
            window.location.href = 'login.html';
        });
    }
}

function updatePageDateTime() {
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

function updateHeaderLastUpdate(date) {
    const chip = document.getElementById('pageLastUpdate');
    if (!chip) return;
    chip.innerHTML = `<i class="fas fa-clock"></i> Última actualización: ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function exportToCSV() {
    if (!currentAlertsData || currentAlertsData.length === 0) {
        alert('No hay datos para exportar. Por favor, carga algunas alertas primero.');
        return;
    }

    // Crear encabezados del CSV
    const headers = ['#', 'Evento', 'Dispositivo', 'Sensor', 'Valor', 'Fecha', 'Timestamp'];
    
    // Convertir datos a filas CSV
    const rows = currentAlertsData.map((alert, index) => {
        return [
            index + 1,
            getEventLabel(alert.event_type),
            alert.device_id || '—',
            formatSensorType(alert.sensor_type),
            formatSensorValue(alert.sensor_value),
            formatDateTime(alert.timestamp),
            alert.timestamp || ''
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    // Combinar encabezados y filas
    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\n');

    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `alertas_iot_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}
