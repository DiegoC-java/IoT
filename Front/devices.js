// Control de activación/desactivación de sensores
async function toggleSensor(sensor) {
    const btn = document.getElementById(sensor + 'Btn');
    const isActive = btn.textContent === 'Desactivar';
    btn.textContent = isActive ? 'Activar' : 'Desactivar';
    btn.classList.toggle('active', !isActive);

    try {
        const response = await fetch(`http://localhost:3000/api/sensors/${sensor}/${isActive ? 'off' : 'on'}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Error en la comunicación con el backend');
    } catch (err) {
        alert('No se pudo cambiar el estado del sensor: ' + err.message);
    }
}
