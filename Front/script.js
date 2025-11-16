// Variables globales
// ...existing code...

let devicesChart;
let currentData = {};
let isAlarmSystemArmed = true; // El sistema empieza armado por defecto
let refreshInProgress = false; // evita solapado de peticiones
// Configuración de gráficos
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.color = '#64748b';

// --- NUEVO: Función para buscar y actualizar el evento más reciente ---
async function fetchLatestEvent() {
    try {
        const response = await fetch('http://localhost:3000/api/events/latest');
        if (!response.ok) {
            // No mostrar error en consola para no saturar, ya que se llama constantemente
            return;
        }
        const result = await response.json();
        if (result.success && result.data) {
            updateRecentEventCard(result.data);
        } else {
            updateRecentEventCard(null); // No hay eventos
        }
    } catch (error) {
        // Ignorar errores de fetch para que el polling no se detenga
        console.error('Error en fetchLatestEvent:', error.message);
    }
}

// --- NUEVO: Función para actualizar la tarjeta de "Eventos Recientes" en el HTML ---
function updateRecentEventCard(event) {
    const eventContainer = document.getElementById('recent-event-display');
    if (!eventContainer) return;

    if (!event) {
        eventContainer.innerHTML = '<p class="no-events">No hay alertas recientes.</p>';
        return;
    }

    const eventTime = new Date(event.timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let description = 'Evento desconocido';
    let icon = 'fas fa-question-circle';
    let eventClass = ''; // <-- Variable para la clase de color

    if (event.event_type === 'motion_detected') {
        description = 'Movimiento detectado';
        icon = 'fas fa-walking';
        eventClass = 'motion'; // <-- Asigna la clase 'motion'
    } else if (event.event_type === 'vibration_detected') {
        description = 'Vibración detectada';
        icon = 'fas fa-broadcast-tower'; // Un icono más representativo de vibración
        eventClass = 'vibration'; // <-- Asigna la clase 'vibration'
    }

    // Usamos la nueva clase en el div principal para aplicar los colores
    eventContainer.innerHTML = `
        <div class="event-details ${eventClass}">
            <i class="${icon}"></i>
            <span>${description}</span>
        </div>
        <div class="event-time">a las ${eventTime}</div>
    `;
}

// Verificar autenticación al cargar el dashboard
function checkAuthentication() {
    const currentUser = localStorage.getItem('iot_user');
    const loginTime = localStorage.getItem('iot_login_time');
    
    if (!currentUser || !loginTime) {
        // No hay sesión, redirigir a login
        console.log('❌ No hay sesión activa, redirigiendo a login');
        window.location.href = 'login.html';
        return false;
    }
    
    try {
        const userData = JSON.parse(currentUser);
        const now = new Date().getTime();
        const sessionTime = parseInt(loginTime);
        const sessionDuration = 24 * 60 * 60 * 1000; // 24 horas
        
        if (now - sessionTime >= sessionDuration) {
            // Sesión expirada
            console.log('⏰ Sesión expirada, redirigiendo a login');
            localStorage.removeItem('iot_user');
            localStorage.removeItem('iot_login_time');
            alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            window.location.href = 'login.html';
            return false;
        }
        
        // Mostrar información del usuario en el header
        showUserInfo(userData);
        console.log('✅ Sesión válida para:', userData.username);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error verificando sesión:', error);
        localStorage.removeItem('iot_user');
        localStorage.removeItem('iot_login_time');
        window.location.href = 'login.html';
        return false;
    }
}

// Mostrar información del usuario
function showUserInfo(userData) {
    const headerControls = document.querySelector('.header-controls');
    if (headerControls) {
        headerControls.innerHTML = '';

        // Botón Salir
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-logout';
        logoutBtn.style.cssText = `
            padding: 0.5rem 1rem;
            background: var(--danger-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            margin-right: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        logoutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Salir`;
        logoutBtn.onclick = logout;

        // Fecha y hora actual
        let datetimeElement = document.getElementById('datetime');
        if (!datetimeElement) {
            datetimeElement = document.createElement('small');
            datetimeElement.id = 'datetime';
            datetimeElement.style.cssText = `
                color: #64748b;
                font-size: 0.75rem;
                margin-right: 1rem;
                padding: 0.25rem 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                backdrop-filter: blur(5px);
                display: inline-block;
            `;
        }

        // Botón Actualizar
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshBtn';
        refreshBtn.className = 'btn-refresh';
        refreshBtn.style.cssText = `
            padding: 0.5rem 1rem;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            margin-right: 1rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        `;
        refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Actualizar`;
        refreshBtn.addEventListener('click', refreshData);

        // Indicador de última actualización
        let updateIndicator = document.getElementById('lastUpdate');
        if (!updateIndicator) {
            updateIndicator = document.createElement('small');
            updateIndicator.id = 'lastUpdate';
            updateIndicator.style.cssText = `
                color: #64748b;
                font-size: 0.75rem;
                margin-right: 1rem;
                padding: 0.25rem 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                backdrop-filter: blur(5px);
                display: inline-block;
            `;
        }

        // Estructura: [SALIR] [fecha/hora actual] [ACTUALIZAR] [última actualización]
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.alignItems = 'center';
        headerRow.style.justifyContent = 'flex-end';
        headerRow.appendChild(logoutBtn);
        headerRow.appendChild(datetimeElement);
        headerRow.appendChild(refreshBtn);
        headerRow.appendChild(updateIndicator);
        headerControls.appendChild(headerRow);
    }
}

// Función de logout
function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        console.log('👋 Cerrando sesión...');
        
        // Llamar al endpoint de logout si está disponible
        try {
            fetch('http://localhost:3000/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => {}); // Ignorar errores del backend
        } catch (error) {
            console.log('Backend no disponible para logout');
        }
        
        // Limpiar sesión local
        localStorage.removeItem('iot_user');
        localStorage.removeItem('iot_login_time');
        window.location.href = 'login.html';
    }
}

// Inicialización cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación antes de inicializar
    if (!checkAuthentication()) {
        return; // No continuar si no está autenticado
    }

    // Mostrar fecha y hora actuales en el header
    updateDateTime();

    // Continuar con la inicialización normal del dashboard
    console.log('🚀 Inicializando dashboard...');
    initializeDashboard();
});

// Función principal de inicialización
async function initializeDashboard() {
    //showLoading(true);
    
    try {
        // Cargar datos
        await loadData();
        
        // Inicializar componentes
        await fetchLatestEvent();
        updateDateTime();
        initializeCharts();
        populateDevicesTable();
        setupEventListeners();
        //logica del armado y desarmado
        setupAlarmControls(); // Asigna el evento 'click' a la tarjeta
        updateAlarmUI();
        // Actualizar datos cada 30 segundos
        setInterval(refreshData, 3000);
        setInterval(fetchLatestEvent, 5000); // <-- ¡ESTA ES LA LÍNEA QUE FALTABA!

        //showLoading(false);
        console.log('✅ Dashboard inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando dashboard:', error);
        //showLoading(false);
    }
    setupAlarmControls();
    updateAlarmUI(); // Llama para establecer el estado visual inicial
}

function updateAlarmUI() {
    const statusText = document.getElementById('system-status-text');
    const statusIcon = document.getElementById('system-status-icon');
    
    if (!statusText || !statusIcon) return;

    if (isAlarmSystemArmed) {
        statusText.textContent = 'Armado';
        statusIcon.className = 'kpi-icon armed';
    } else {
        statusText.textContent = 'Desarmado';
        statusIcon.className = 'kpi-icon disarmed';
    }
}

// Función que se ejecuta al hacer clic en la tarjeta de control
async function handleToggleAlarm() {
    const newState = isAlarmSystemArmed ? 'inactive' : 'active';
    console.log(`Enviando comando para poner la alarma en estado: ${newState}`);

    try {
        const response = await fetch('http://localhost:3000/api/alarm/set-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: newState }),
        });

        if (!response.ok) throw new Error('La respuesta del servidor no fue OK');

        const result = await response.json();

        if (result.success) {
            isAlarmSystemArmed = (newState === 'active');
            updateAlarmUI();
            console.log(`✅ Comando procesado. Nuevo estado: ${newState}`);
        } else {
            alert('Error al cambiar el estado de la alarma: ' + result.message);
        }
    } catch (error) {
        console.error('Error de red al intentar cambiar el estado:', error);
        alert('Error de conexión con el servidor. No se pudo cambiar el estado de la alarma.');
    }
}

// Asigna el evento 'click' a la tarjeta de control
function setupAlarmControls() {
    const controlCard = document.getElementById('alarm-control-card');
    if (controlCard) {
        controlCard.addEventListener('click', handleToggleAlarm);
    }
}
// Cargar datos desde el backend
async function loadData() {
    try {
        console.log('🔄 Cargando datos desde el backend...');
        //showLoading(true);
        
        // Request only the real device (ESP32) to avoid showing seeded/simulated devices
        const response = await fetch('http://localhost:3000/api/devices?device_id=ESP32_ALARM_01');
        console.log('📡 Estado de la respuesta:', response.status);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        console.log('📦 Datos recibidos:', result);

        if (!result.success) {
            throw new Error(result.message || 'Error en la respuesta del servidor');
        }

        // Actualizar datos globales
        currentData = {
            devices: result.data || [],
            kpis: {
                systemStatus: { 
                    current: result.data.length > 0 ? 'Activo' : 'Sin dispositivos' 
                },
                activeDevices: { 
                    current: result.data.filter(d => d.status === 'online').length 
                },
                alerts: { 
                    current: result.data.filter(d => d.status === 'warning').length 
                },
                recentEvents: { 
                    current: 0  // Update this based on your events logic
                }
            }
        };

        // Actualizar UI
        updateKPIs();
        updateDevicesChart();
        populateDevicesTable();
        updateLastUpdate();
        //showLoading(false);

    } catch (error) {
        console.error('❌ Error:', error);
        //showLoading(false);
        await loadDataFallback();
    }
}

// Función para cargar datos de respaldo
async function loadDataFallback() {
    console.log('📊 Cargando datos de respaldo...');
    currentData = {
        devices: [
            {
                id: "DEV001",
                name: "Sensor Puerta Principal",
                type: "Contacto",
                location: "Entrada",
                status: "online",
                value: "Cerrado",
                lastReading: new Date().toLocaleString(),
                battery: 85,
                signal: "Buena"
            },
            {
                id: "DEV002",
                name: "Sensor Ventana Sala",
                type: "Contacto",
                location: "Sala",
                status: "online",
                value: "Cerrado",
                lastReading: new Date().toLocaleString(),
                battery: 90,
                signal: "Excelente"
            },
            {
                id: "DEV003",
                name: "Sensor Movimiento",
                type: "Movimiento",
                location: "Pasillo",
                status: "warning",
                value: "Sin movimiento",
                lastReading: new Date().toLocaleString(),
                battery: 15,
                signal: "Regular"
            }
        ],
        kpis: {
            systemStatus: { current: 'Activo' },
            activeDevices: { current: 2 },
            alerts: { current: 1 },
            recentEvents: { current: 0 }
        }
    };

    // Actualizar UI con datos de respaldo
    updateKPIs();
    updateDevicesChart();
    populateDevicesTable();
    updateLastUpdate();
}

function updateKPIs() {
    const kpis = currentData.kpis;
    
    // Helper function to safely update element
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`⚠️ Elemento KPI no encontrado: ${id}`);
        }
    };

    // Update each KPI safely
    updateElement('systemStatus', kpis.systemStatus?.current || 'N/A');
    updateElement('activeDevices', kpis.activeDevices?.current || '0');
    updateElement('alerts', kpis.alerts?.current || '0');
    updateElement('recentEvents', kpis.recentEvents?.current || '0');
}

// Actualizar información de última actualización
function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Buscar y actualizar el indicador de última actualización si existe
    let updateIndicator = document.getElementById('lastUpdate');
    if (!updateIndicator) {
        // Crear indicador si no existe
        updateIndicator = document.createElement('small');
        updateIndicator.id = 'lastUpdate';
        updateIndicator.style.cssText = `
            color: #64748b;
            font-size: 0.75rem;
            margin-left: auto;
            padding: 0.25rem 0.5rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(5px);
        `;
        
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.appendChild(updateIndicator);
        }
    }
    updateIndicator.innerHTML = `<i class="fas fa-clock"></i> Última actualización: ${timeString}`;
}

// Generar datos históricos de temperatura

// Generar datos de dispositivos

// Inicializar gráficos
function initializeCharts() {
    try {
        initializeDevicesChart();
        console.log('📈 Gráficos inicializados');
    } catch (error) {
        console.error('❌ Error inicializando gráficos:', error);
    }
}


// Gráfico de estado de dispositivos
function initializeDevicesChart() {
    const ctx = document.getElementById('devicesChart');
    if (!ctx) {
        console.warn('⚠️ Elemento devicesChart no encontrado');
        return;
    }
    
    const chartCtx = ctx.getContext('2d');
    
    const statusCount = { online: 0, offline: 0, warning: 0 };
    if(currentData.devices) {
        currentData.devices.forEach(device => {
            statusCount[device.status] = (statusCount[device.status] || 0) + 1;
        });
    }
    
    // Si ya existe un gráfico, destrúyelo antes de crear uno nuevo
    if (devicesChart) {
        devicesChart.destroy();
    }
    
    devicesChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: ['En línea', 'Fuera de línea', 'Advertencia'],
            datasets: [{
                data: [
                    statusCount.online,
                    statusCount.offline,
                    statusCount.warning
                ],
                backgroundColor: [
                    '#22c55e', // Verde para 'En línea'
                    '#ef4444', // Rojo para 'Fuera de línea'
                    '#f59e0b'  // Naranja para 'Advertencia'
                ],
                borderWidth: 4, // Borde más grueso para mejor separación
                borderColor: '#1e293b' // Color de fondo del contenedor
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', // Hacer el donut un poco más delgado
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        color: '#cbd5e1' // <-- CAMBIO CLAVE: Color de la leyenda
                    }
                },
                title: { // <-- NUEVO: Para controlar el título
                    display: true,
                    text: 'Estado de Dispositivos',
                    color: '#e2e8f0', // <-- CAMBIO CLAVE: Color del título
                    font: {
                        size: 18,
                        weight: '600'
                    },
                    padding: {
                        bottom: 20
                    }
                },
                tooltip: {
                    // (Tu configuración de tooltip es correcta, no necesita cambios)
                }
            }
        }
    });
}

// Poblar tabla de dispositivos
function populateDevicesTable() {
    const tbody = document.getElementById('devicesTableBody');
    if (!tbody) {
        console.warn('⚠️ Elemento devicesTableBody no encontrado');
        return;
    }
    
    tbody.innerHTML = '';
    
    currentData.devices.forEach(device => {
        const row = tbody.insertRow();
        
        row.innerHTML = `
            <td>${device.id}</td>
            <td>${device.name}</td>
            <td>${device.type}</td>
            <td><span class="status-badge status-${device.status}">${getStatusText(device.status)}</span></td>
            <td>${device.lastReading}</td>
            <td>${device.value}${device.unit || getUnitForDevice(device.type)}</td>
            <td>
                <button class="btn-action" onclick="viewDevice('${device.id}')">
                    <i class="fas fa-eye"></i> Ver
                </button>
                <button class="btn-action" onclick="editDevice('${device.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
            </td>
        `;
    });
    
    console.log(`📊 Tabla de dispositivos actualizada: ${currentData.devices.length} dispositivos`);
}

// Obtener texto de estado
function getStatusText(status) {
    const statusTexts = {
        'online': 'En línea',
        'offline': 'Fuera de línea',
        'warning': 'Advertencia'
    };
    return statusTexts[status] || status;
}

// Obtener unidad para tipo de dispositivo
function getUnitForDevice(type) {
    if (type.includes('Temperatura')) return '°C';
    if (type.includes('Humedad')) return '%';
    if (type.includes('Presión')) return 'hPa';
    if (type.includes('Luz')) return 'lux';
    return '';
}

// Configurar event listeners
function setupEventListeners() {
    try {
        // Botón de actualizar
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshData);
        }
        
        
        // Botón de exportar
        const exportBtn = document.querySelector('.btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportData);
        }
        
        // Navegación del sidebar
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                // Solo prevenir el comportamiento por defecto si es un anchor interno (hash)
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    document.querySelectorAll('.nav-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    this.parentElement.classList.add('active');
                    const section = href.substring(1);
                    console.log(`📍 Navegando a: ${section}`);
                }
                // Si es un archivo .html, dejar que el navegador navegue normalmente
            });
        });
        
        console.log('🎛️ Event listeners configurados');
    } catch (error) {
        console.error('❌ Error configurando event listeners:', error);
    }
}

// Actualizar fecha y hora
function updateDateTime() {
    try {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        let datetimeElement = document.getElementById('datetime');
        if (!datetimeElement) {
            datetimeElement = document.createElement('small');
            datetimeElement.id = 'datetime';
            datetimeElement.style.cssText = `
                color: #64748b;
                font-size: 0.75rem;
                margin-left: 1rem;
                padding: 0.25rem 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                backdrop-filter: blur(5px);
                display: inline-block;
            `;
            const headerControls = document.querySelector('.header-controls');
            if (headerControls) {
                headerControls.appendChild(datetimeElement);
            }
        }
        datetimeElement.textContent = `${now.toLocaleDateString('es-ES', options)}`;

        // Actualizar cada minuto
        setTimeout(updateDateTime, 60000);
    } catch (error) {
        console.error('❌ Error actualizando fecha y hora:', error);
    }
}

// Mostrar/ocultar loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
}

// Refrescar datos
async function refreshData() {
    if (refreshInProgress) {
        return; // hay una actualización en curso
    }
    refreshInProgress = true;
    const refreshBtn = document.getElementById('refreshBtn');
    const icon = refreshBtn ? refreshBtn.querySelector('i') : null;
    
    // Animar icono de refresh
    if (icon) {
        icon.style.animation = 'spin 1s linear infinite';
    }
    
    try {
        console.log('🔄 Refrescando datos...');
        await loadData();
        await fetchLatestEvent(); // --- NUEVO: Refresca también el último evento ---
        
    // Actualizar gráfico de dispositivos
    updateDevicesChart();
    // Actualizar tabla
    populateDevicesTable();
    console.log('✅ Datos refrescados exitosamente');
    } catch (error) {
        console.error('❌ Error refrescando datos:', error);
    } finally {
        // Detener animación
        if (icon) {
            setTimeout(() => {
                icon.style.animation = '';
            }, 1000);
        }
        refreshInProgress = false;
    }
}



// Actualizar gráfico de dispositivos
function updateDevicesChart() {
    if (!devicesChart) return;
    
    try {
        // Contar estados de dispositivos
        const statusCount = { online: 0, offline: 0, warning: 0 };
        currentData.devices.forEach(device => {
            statusCount[device.status] = (statusCount[device.status] || 0) + 1;
        });
        
        devicesChart.data.datasets[0].data = [
            statusCount.online,
            statusCount.offline,
            statusCount.warning
        ];
        devicesChart.update();
        
        console.log('📊 Gráfico de dispositivos actualizado');
    } catch (error) {
        console.error('❌ Error actualizando gráfico de dispositivos:', error);
    }
}

// Funciones para acciones de dispositivos
async function viewDevice(deviceId) {
    try {
        console.log(`👁️ Viendo dispositivo: ${deviceId}`);
        
        // Intentar obtener datos del backend
        const response = await fetch(`http://localhost:3000/api/devices/${deviceId}`);
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                const device = result.data;
                const lastReading = new Date(device.last_reading).toLocaleString('es-ES');
                
                alert(`📱 Dispositivo: ${device.name}\n🏷️ ID: ${device.id}\n📍 Ubicación: ${device.location}\n🔄 Estado: ${getStatusText(device.status)}\n📊 Valor: ${device.value || 'N/A'} ${device.unit || ''}\n🔋 Batería: ${device.battery || 'N/A'}%\n📡 Señal: ${device.signal || 'N/A'}\n⏰ Última lectura: ${lastReading}`);
                return;
            }
        }
    } catch (error) {
        console.error('❌ Error obteniendo detalles del dispositivo:', error);
    }
    
    // Fallback a datos locales
    const device = currentData.devices.find(d => d.id === deviceId);
    if (device) {
        alert(`📱 Dispositivo: ${device.name}\n🏷️ ID: ${device.id}\n📍 Ubicación: ${device.location || 'No especificada'}\n🔄 Estado: ${getStatusText(device.status)}\n📊 Valor: ${device.value} ${device.unit || ''}\n🔋 Batería: ${device.battery || 'N/A'}%\n📡 Señal: ${device.signal || 'N/A'}\n⏰ Última lectura: ${device.lastReading}`);
    } else {
        alert('❌ Dispositivo no encontrado');
    }
}

async function editDevice(deviceId) {
    try {
        console.log(`✏️ Editando dispositivo: ${deviceId}`);
        
        const device = currentData.devices.find(d => d.id === deviceId);
        if (!device) {
            alert('❌ Dispositivo no encontrado');
            return;
        }
        
        const newName = prompt(`Editar nombre del dispositivo (${device.id}):`, device.name);
        if (newName && newName.trim() && newName.trim() !== device.name) {
            try {
                // Intentar actualizar en el backend
                const response = await fetch(`http://localhost:3000/api/devices/${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: newName.trim(),
                        type: device.type,
                        location: device.location,
                        status: device.status,
                        value: device.value,
                        unit: device.unit,
                        battery: device.battery,
                        signal: device.signal
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        console.log('✅ Dispositivo actualizado en el backend');
                        await refreshData();
                        return;
                    }
                }
                
                throw new Error('Error del servidor');
            } catch (error) {
                console.error('❌ Error actualizando dispositivo:', error);
                alert('⚠️ Error al actualizar en el servidor. Actualizando localmente...');
                
                // Fallback a actualización local
                device.name = newName.trim();
                populateDevicesTable();
                console.log(`✅ Dispositivo ${deviceId} actualizado localmente`);
            }
        }
    } catch (error) {
        console.error('❌ Error en editDevice:', error);
        alert('❌ Error editando dispositivo');
    }
}

// Exportar datos
function exportData() {
    try {
        console.log('📤 Exportando datos...');
        const csvContent = generateCSV();
        downloadCSV(csvContent, `dispositivos_iot_${new Date().toISOString().split('T')[0]}.csv`);
        console.log('✅ Datos exportados');
    } catch (error) {
        console.error('❌ Error exportando datos:', error);
        alert('❌ Error al exportar datos');
    }
}

// Generar contenido CSV
function generateCSV() {
    const headers = ['ID', 'Nombre', 'Tipo', 'Ubicación', 'Estado', 'Última Lectura', 'Valor', 'Batería', 'Señal'];
    const rows = currentData.devices.map(device => [
        device.id,
        device.name,
        device.type,
        device.location || 'No especificada',
        getStatusText(device.status),
        device.lastReading,
        `${device.value}${device.unit || getUnitForDevice(device.type)}`,
        `${device.battery || 'N/A'}%`,
        device.signal || 'N/A'
    ]);
    
    const csvArray = [headers, ...rows];
    return csvArray.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

// Descargar archivo CSV
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Animación CSS para el icono de refresh
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .user-info .btn-logout:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .btn-action {
        margin: 0 2px;
        padding: 0.25rem 0.5rem;
        border: none;
        border-radius: 4px;
        background: var(--primary-color);
        color: white;
        cursor: pointer;
        font-size: 0.75rem;
        transition: var(--transition);
    }
    
    .btn-action:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
    }
    
    .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .status-online {
        background: rgba(34, 197, 94, 0.1);
        color: #16a34a;
        border: 1px solid rgba(34, 197, 94, 0.2);
    }
    
    .status-offline {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
        border: 1px solid rgba(239, 68, 68, 0.2);
    }
    
    .status-warning {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
        border: 1px solid rgba(245, 158, 11, 0.2);
    }
`;
document.head.appendChild(style);

// Manejar errores globales
window.addEventListener('error', function(e) {
    console.error('❌ Error global:', e.error);
});

// Manejar visibilidad de la página para pausar/reanudar actualizaciones
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('🔇 Página oculta, pausando actualizaciones');
    } else {
        console.log('👁️ Página visible, reanudando actualizaciones');
        refreshData();
    }
});

// Función para simular datos en tiempo real (opcional)
// ...eliminada simulación de temperatura y humedad...

// Iniciar simulación en tiempo real (descomenta si quieres datos que cambien automáticamente)
//startRealTimeSimulation();

console.log('🎉 Dashboard IoT cargado correctamente');