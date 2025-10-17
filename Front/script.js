// Variables globales
let temperatureChart;
let devicesChart;
let currentData = {};

// Configuración de gráficos
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.color = '#64748b';

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
    if (headerControls && !document.getElementById('userInfo')) {
        const userInfo = document.createElement('div');
        userInfo.id = 'userInfo';
        userInfo.innerHTML = `
            <div class="user-info" style="
                display: flex; 
                align-items: center; 
                gap: 1rem; 
                margin-right: 1rem;
                padding: 0.5rem 1rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            ">
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="color: var(--text-primary); font-size: 0.875rem; font-weight: 600;">
                        <i class="fas fa-user"></i> ${userData.username}
                    </span>
                    <span style="color: var(--text-secondary); font-size: 0.75rem;">
                        ${userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Usuario'}
                    </span>
                </div>
                <button onclick="logout()" class="btn-logout" style="
                    padding: 0.5rem 1rem; 
                    background: var(--danger-color); 
                    color: white; 
                    border: none; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    font-size: 0.875rem;
                    transition: var(--transition);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='var(--danger-color)'">
                    <i class="fas fa-sign-out-alt"></i> Salir
                </button>
            </div>
        `;
        headerControls.insertBefore(userInfo, headerControls.firstChild);
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
    
    // Continuar con la inicialización normal del dashboard
    console.log('🚀 Inicializando dashboard...');
    initializeDashboard();
});

// Función principal de inicialización
async function initializeDashboard() {
    showLoading(true);
    
    try {
        // Cargar datos
        await loadData();
        
        // Inicializar componentes
        updateDateTime();
        initializeCharts();
        populateDevicesTable();
        setupEventListeners();
        
        // Actualizar datos cada 30 segundos
        setInterval(refreshData, 30000);
        
        showLoading(false);
        console.log('✅ Dashboard inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando dashboard:', error);
        showLoading(false);
    }
}

// Cargar datos desde el backend
async function loadData() {
    try {
        console.log('🔄 Cargando datos desde el backend...');
        
        const response = await fetch('http://localhost:3000/api/dashboard', {
            timeout: 5000 // Timeout de 5 segundos
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Datos cargados desde el backend:', result.message);
            console.log('📊 Fuente de datos:', result.dataSource || 'backend');
            currentData = result.data;
            updateKPIs();
            updateLastUpdate();
        } else {
            throw new Error(result.message || 'Error desconocido del servidor');
        }
    } catch (error) {
        console.error('❌ Error cargando datos del backend:', error.message);
        console.log('🔄 Usando datos simulados como fallback...');
        
        // Fallback a datos simulados si el backend no está disponible
        await loadDataFallback();
    }
}

// Función fallback con datos simulados
async function loadDataFallback() {
    // Simulación de carga de datos
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    currentData = {
        kpis: {
            temperature: { current: 23.5 + Math.random() * 5, unit: '°C', trend: 'positive', change: 1.2 },
            humidity: { current: 65 + Math.random() * 10, unit: '%', trend: 'negative', change: -2.1 },
            activeDevices: { current: 12 + Math.floor(Math.random() * 3), total: 15, trend: 'positive', change: 3 },
            alerts: { current: Math.floor(Math.random() * 5), critical: 0, warning: 2, trend: 'neutral' }
        },
        temperatureHistory: generateTemperatureHistory(),
        devices: generateDevicesData(),
        deviceStatus: {
            online: 8,
            offline: 2,
            warning: 2
        }
    };
    
    updateKPIs();
    updateLastUpdate();
    console.log('📊 Datos simulados cargados');
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
function generateTemperatureHistory() {
    const history = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        const baseTemp = 23;
        const variation = Math.sin(i * 0.5) * 3 + Math.random() * 2;
        
        history.push({
            time: time.toISOString(),
            temperature: Math.round((baseTemp + variation) * 10) / 10,
            humidity: Math.round((65 + Math.sin(i * 0.3) * 10 + Math.random() * 5) * 10) / 10
        });
    }
    
    return history;
}

// Generar datos de dispositivos
function generateDevicesData() {
    const deviceTypes = ['Sensor Temperatura', 'Sensor Humedad', 'Cámara', 'Actuador', 'Gateway'];
    const locations = ['Jardín', 'Cocina', 'Sala', 'Dormitorio', 'Garage', 'Terraza'];
    const statuses = ['online', 'offline', 'warning'];
    const devices = [];
    
    for (let i = 1; i <= 12; i++) {
        const type = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const device = {
            id: `DEV-${i.toString().padStart(3, '0')}`,
            name: `${type} ${location}`,
            type: type,
            location: location,
            status: status,
            lastReading: new Date(Date.now() - Math.random() * 3600000).toLocaleString('es-ES'),
            value: type.includes('Temperatura') ? (20 + Math.random() * 15).toFixed(1) :
                   type.includes('Humedad') ? (50 + Math.random() * 30).toFixed(0) :
                   (Math.random() * 100).toFixed(1),
            unit: type.includes('Temperatura') ? '°C' :
                  type.includes('Humedad') ? '%' : '',
            battery: Math.floor(20 + Math.random() * 80),
            signal: ['excelente', 'buena', 'regular'][Math.floor(Math.random() * 3)]
        };
        devices.push(device);
    }
    
    return devices;
}

// Actualizar KPIs
function updateKPIs() {
    try {
        // Manejar ambos formatos de datos (backend y fallback)
        const temp = currentData.kpis.temperature;
        const humidity = currentData.kpis.humidity;
        const devices = currentData.kpis.activeDevices;
        const alerts = currentData.kpis.alerts;
        
        // Temperatura
        const tempValue = typeof temp === 'object' ? temp.current : temp;
        const tempElement = document.getElementById('temperature');
        if (tempElement) {
            tempElement.textContent = `${tempValue.toFixed(1)}°C`;
        }
        
        // Humedad
        const humidityValue = typeof humidity === 'object' ? humidity.current : humidity;
        const humidityElement = document.getElementById('humidity');
        if (humidityElement) {
            humidityElement.textContent = `${humidityValue.toFixed(0)}%`;
        }
        
        // Dispositivos activos
        const devicesValue = typeof devices === 'object' ? devices.current : devices;
        const devicesElement = document.getElementById('activeDevices');
        if (devicesElement) {
            devicesElement.textContent = devicesValue;
        }
        
        // Alertas
        const alertsValue = typeof alerts === 'object' ? alerts.current : alerts;
        const alertsElement = document.getElementById('alerts');
        if (alertsElement) {
            alertsElement.textContent = alertsValue;
        }
        
        console.log('📊 KPIs actualizados:', { 
            temp: tempValue, 
            humidity: humidityValue, 
            devices: devicesValue, 
            alerts: alertsValue 
        });
    } catch (error) {
        console.error('❌ Error actualizando KPIs:', error);
    }
}

// Inicializar gráficos
function initializeCharts() {
    try {
        initializeTemperatureChart();
        initializeDevicesChart();
        console.log('📈 Gráficos inicializados');
    } catch (error) {
        console.error('❌ Error inicializando gráficos:', error);
    }
}

// Gráfico de temperatura
function initializeTemperatureChart() {
    const ctx = document.getElementById('temperatureChart');
    if (!ctx) {
        console.warn('⚠️ Elemento temperatureChart no encontrado');
        return;
    }
    
    const chartCtx = ctx.getContext('2d');
    
    const labels = currentData.temperatureHistory.map(item => {
        return new Date(item.time).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    });
    
    const temperatures = currentData.temperatureHistory.map(item => item.temperature);
    const humidities = currentData.temperatureHistory.map(item => item.humidity);
    
    temperatureChart = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperatura (°C)',
                data: temperatures,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true,
                yAxisID: 'y'
            }, {
                label: 'Humedad (%)',
                data: humidities,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Hora'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperatura (°C)'
                    },
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humedad (%)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Gráfico de estado de dispositivos
function initializeDevicesChart() {
    const ctx = document.getElementById('devicesChart');
    if (!ctx) {
        console.warn('⚠️ Elemento devicesChart no encontrado');
        return;
    }
    
    const chartCtx = ctx.getContext('2d');
    
    // Calcular estados de dispositivos
    const statusCount = { online: 0, offline: 0, warning: 0 };
    currentData.devices.forEach(device => {
        statusCount[device.status] = (statusCount[device.status] || 0) + 1;
    });
    
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
                    '#22c55e',
                    '#ef4444',
                    '#f59e0b'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
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
        
        // Selector de rango de tiempo
        const timeRangeSelect = document.getElementById('temperatureTimeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', function(e) {
                updateTemperatureChart(e.target.value);
            });
        }
        
        // Botón de exportar
        const exportBtn = document.querySelector('.btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportData);
        }
        
        // Navegación del sidebar
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Remover clase active de todos los elementos
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Agregar clase active al elemento clickeado
                this.parentElement.classList.add('active');
                
                // Navegación
                const section = this.getAttribute('href').substring(1);
                console.log(`📍 Navegando a: ${section}`);
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
        
        const datetimeElement = document.getElementById('datetime');
        if (datetimeElement) {
            datetimeElement.textContent = now.toLocaleDateString('es-ES', options);
        }
        
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
    const refreshBtn = document.getElementById('refreshBtn');
    const icon = refreshBtn ? refreshBtn.querySelector('i') : null;
    
    // Animar icono de refresh
    if (icon) {
        icon.style.animation = 'spin 1s linear infinite';
    }
    
    try {
        console.log('🔄 Refrescando datos...');
        await loadData();
        
        // Actualizar gráficos
        updateTemperatureChart();
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
    }
}

// Actualizar gráfico de temperatura
function updateTemperatureChart(timeRange = '24h') {
    if (!temperatureChart) return;
    
    try {
        // Filtrar datos según el rango de tiempo (implementación futura)
        const filteredData = currentData.temperatureHistory;
        
        const labels = filteredData.map(item => {
            return new Date(item.time).toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        });
        
        temperatureChart.data.labels = labels;
        temperatureChart.data.datasets[0].data = filteredData.map(item => item.temperature);
        temperatureChart.data.datasets[1].data = filteredData.map(item => item.humidity);
        temperatureChart.update();
        
        console.log('📈 Gráfico de temperatura actualizado');
    } catch (error) {
        console.error('❌ Error actualizando gráfico de temperatura:', error);
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
function startRealTimeSimulation() {
    setInterval(() => {
        try {
            // Actualizar KPIs con pequeñas variaciones
            if (currentData.kpis.temperature.current) {
                currentData.kpis.temperature.current += (Math.random() - 0.5) * 0.5;
                currentData.kpis.humidity.current += (Math.random() - 0.5) * 2;
                
                // Mantener valores en rangos realistas
                currentData.kpis.temperature.current = Math.max(15, Math.min(35, currentData.kpis.temperature.current));
                currentData.kpis.humidity.current = Math.max(30, Math.min(90, currentData.kpis.humidity.current));
                
                updateKPIs();
                
                // Agregar nuevo punto al historial
                const now = new Date();
                currentData.temperatureHistory.push({
                    time: now.toISOString(),
                    temperature: currentData.kpis.temperature.current,
                    humidity: currentData.kpis.humidity.current
                });
                
                // Mantener solo las últimas 24 horas
                if (currentData.temperatureHistory.length > 24) {
                    currentData.temperatureHistory.shift();
                }
                
                updateTemperatureChart();
            }
        } catch (error) {
            console.error('❌ Error en simulación tiempo real:', error);
        }
    }, 60000); // Actualizar cada minuto
}

// Iniciar simulación en tiempo real (descomenta si quieres datos que cambien automáticamente)
//startRealTimeSimulation();

console.log('🎉 Dashboard IoT cargado correctamente');