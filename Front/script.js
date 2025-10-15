// Variables globales
let temperatureChart;
let devicesChart;
let currentData = {};

// Configuración de gráficos
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.color = '#64748b';

// Inicialización cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
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
    } catch (error) {
        console.error('Error inicializando dashboard:', error);
        showLoading(false);
    }
}

// Cargar datos desde el backend
async function loadData() {
    try {
        console.log('🔄 Cargando datos desde el backend...');
        
        const response = await fetch('http://localhost:3000/api/dashboard');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Datos cargados desde el backend:', result.message);
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

// Función fallback con datos simulados (datos originales)
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
        updateIndicator.style.color = '#64748b';
        updateIndicator.style.fontSize = '0.75rem';
        
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.appendChild(updateIndicator);
        }
    }
    updateIndicator.textContent = `Última actualización: ${timeString}`;
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
            temperature: baseTemp + variation,
            humidity: 65 + Math.sin(i * 0.3) * 10 + Math.random() * 5
        });
    }
    
    return history;
}

// Generar datos de dispositivos
function generateDevicesData() {
    const deviceTypes = ['Sensor Temperatura', 'Sensor Humedad', 'Cámara', 'Actuador', 'Gateway'];
    const statuses = ['online', 'offline', 'warning'];
    const devices = [];
    
    for (let i = 1; i <= 12; i++) {
        const device = {
            id: `DEV-${i.toString().padStart(3, '0')}`,
            name: `${deviceTypes[Math.floor(Math.random() * deviceTypes.length)]} ${i}`,
            type: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            lastReading: new Date(Date.now() - Math.random() * 3600000).toLocaleString(),
            value: (Math.random() * 100).toFixed(1)
        };
        devices.push(device);
    }
    
    return devices;
}

// Actualizar KPIs
function updateKPIs() {
    // Manejar ambos formatos de datos (backend y fallback)
    const temp = currentData.kpis.temperature;
    const humidity = currentData.kpis.humidity;
    const devices = currentData.kpis.activeDevices;
    const alerts = currentData.kpis.alerts;
    
    // Temperatura
    const tempValue = typeof temp === 'object' ? temp.current : temp;
    document.getElementById('temperature').textContent = `${tempValue.toFixed(1)}°C`;
    
    // Humedad
    const humidityValue = typeof humidity === 'object' ? humidity.current : humidity;
    document.getElementById('humidity').textContent = `${humidityValue.toFixed(0)}%`;
    
    // Dispositivos activos
    const devicesValue = typeof devices === 'object' ? devices.current : devices;
    document.getElementById('activeDevices').textContent = devicesValue;
    
    // Alertas
    const alertsValue = typeof alerts === 'object' ? alerts.current : alerts;
    document.getElementById('alerts').textContent = alertsValue;
    
    console.log('📊 KPIs actualizados:', { temp: tempValue, humidity: humidityValue, devices: devicesValue, alerts: alertsValue });
}

// Inicializar gráficos
function initializeCharts() {
    initializeTemperatureChart();
    initializeDevicesChart();
}

// Gráfico de temperatura
function initializeTemperatureChart() {
    const ctx = document.getElementById('temperatureChart').getContext('2d');
    
    const labels = currentData.temperatureHistory.map(item => {
        return new Date(item.time).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    });
    
    const temperatures = currentData.temperatureHistory.map(item => item.temperature);
    const humidities = currentData.temperatureHistory.map(item => item.humidity);
    
    temperatureChart = new Chart(ctx, {
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
    const ctx = document.getElementById('devicesChart').getContext('2d');
    
    devicesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['En línea', 'Fuera de línea', 'Advertencia'],
            datasets: [{
                data: [
                    currentData.deviceStatus.online,
                    currentData.deviceStatus.offline,
                    currentData.deviceStatus.warning
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
                            const percentage = ((value / total) * 100).toFixed(1);
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
    tbody.innerHTML = '';
    
    currentData.devices.forEach(device => {
        const row = tbody.insertRow();
        
        row.innerHTML = `
            <td>${device.id}</td>
            <td>${device.name}</td>
            <td>${device.type}</td>
            <td><span class="status-badge status-${device.status}">${getStatusText(device.status)}</span></td>
            <td>${device.lastReading}</td>
            <td>${device.value}${getUnitForDevice(device.type)}</td>
            <td>
                <button class="btn-action" onclick="viewDevice('${device.id}')">Ver</button>
                <button class="btn-action" onclick="editDevice('${device.id}')">Editar</button>
            </td>
        `;
    });
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
    return '';
}

// Configurar event listeners
function setupEventListeners() {
    // Botón de actualizar
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    
    // Selector de rango de tiempo
    document.getElementById('temperatureTimeRange').addEventListener('change', function(e) {
        updateTemperatureChart(e.target.value);
    });
    
    // Botón de exportar
    document.querySelector('.btn-export').addEventListener('click', exportData);
    
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
            
            // Aquí podrías agregar lógica para cambiar de vista
            const section = this.getAttribute('href').substring(1);
            console.log(`Navegando a: ${section}`);
        });
    });
}

// Actualizar fecha y hora
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    document.getElementById('datetime').textContent = now.toLocaleDateString('es-ES', options);
    
    // Actualizar cada minuto
    setTimeout(updateDateTime, 60000);
}

// Mostrar/ocultar loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// Refrescar datos
async function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    const icon = refreshBtn.querySelector('i');
    
    // Animar icono de refresh
    icon.style.animation = 'spin 1s linear infinite';
    
    try {
        await loadData();
        
        // Actualizar gráficos
        updateTemperatureChart();
        updateDevicesChart();
        
        // Actualizar tabla
        populateDevicesTable();
        
        console.log('Datos actualizados');
    } catch (error) {
        console.error('Error refrescando datos:', error);
    } finally {
        // Detener animación
        setTimeout(() => {
            icon.style.animation = '';
        }, 1000);
    }
}

// Actualizar gráfico de temperatura
function updateTemperatureChart(timeRange = '24h') {
    if (!temperatureChart) return;
    
    // Aquí podrías filtrar los datos según el rango de tiempo
    const filteredData = currentData.temperatureHistory; // Por ahora usar todos los datos
    
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
}

// Actualizar gráfico de dispositivos
function updateDevicesChart() {
    if (!devicesChart) return;
    
    // Contar estados de dispositivos
    const statusCount = { online: 0, offline: 0, warning: 0 };
    currentData.devices.forEach(device => {
        statusCount[device.status]++;
    });
    
    devicesChart.data.datasets[0].data = [
        statusCount.online,
        statusCount.offline,
        statusCount.warning
    ];
    devicesChart.update();
}

// Funciones para acciones de dispositivos
// Funciones para acciones de dispositivos
async function viewDevice(deviceId) {
    try {
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
        console.error('Error obteniendo detalles del dispositivo:', error);
    }
    
    // Fallback a datos locales
    const device = currentData.devices.find(d => d.id === deviceId);
    if (device) {
        alert(`Viendo dispositivo: ${device.name}\nEstado: ${getStatusText(device.status)}\nÚltima lectura: ${device.lastReading || device.lastReading}`);
    }
}

async function editDevice(deviceId) {
    const device = currentData.devices.find(d => d.id === deviceId);
    if (!device) {
        alert('Dispositivo no encontrado');
        return;
    }
    
    const newName = prompt(`Editar nombre del dispositivo (${device.id}):`, device.name);
    if (newName && newName.trim() && newName.trim() !== device.name) {
        try {
            const response = await fetch(`http://localhost:3000/api/devices/${deviceId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newName.trim()
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Dispositivo actualizado en el backend');
                    // Refrescar datos
                    await refreshData();
                    return;
                }
            }
            
            throw new Error('Error del servidor');
        } catch (error) {
            console.error('Error actualizando dispositivo:', error);
            alert('Error al actualizar el dispositivo. Usando datos locales.');
            
            // Fallback a actualización local
            device.name = newName.trim();
            populateDevicesTable();
            console.log(`Dispositivo ${deviceId} actualizado localmente`);
        }
    }
}

// Exportar datos
function exportData() {
    const csvContent = generateCSV();
    downloadCSV(csvContent, 'dispositivos_iot.csv');
}

// Generar contenido CSV
function generateCSV() {
    const headers = ['ID', 'Nombre', 'Tipo', 'Estado', 'Última Lectura', 'Valor'];
    const rows = currentData.devices.map(device => [
        device.id,
        device.name,
        device.type,
        getStatusText(device.status),
        device.lastReading,
        device.value + getUnitForDevice(device.type)
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
    }
}

// Animación CSS para el icono de refresh
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Manejar errores globales
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
});

// Función para simular datos en tiempo real (opcional)
function startRealTimeSimulation() {
    setInterval(() => {
        // Actualizar KPIs con pequeñas variaciones
        currentData.kpis.temperature += (Math.random() - 0.5) * 0.5;
        currentData.kpis.humidity += (Math.random() - 0.5) * 2;
        
        // Mantener valores en rangos realistas
        currentData.kpis.temperature = Math.max(15, Math.min(35, currentData.kpis.temperature));
        currentData.kpis.humidity = Math.max(30, Math.min(90, currentData.kpis.humidity));
        
        updateKPIs();
        
        // Agregar nuevo punto al historial
        const now = new Date();
        currentData.temperatureHistory.push({
            time: now.toISOString(),
            temperature: currentData.kpis.temperature,
            humidity: currentData.kpis.humidity
        });
        
        // Mantener solo las últimas 24 horas
        if (currentData.temperatureHistory.length > 24) {
            currentData.temperatureHistory.shift();
        }
        
        updateTemperatureChart();
    }, 60000); // Actualizar cada minuto
}

// Iniciar simulación en tiempo real (descomenta si quieres datos que cambien automáticamente)
// startRealTimeSimulation();