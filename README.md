# Backend IoT Dashboard

Backend API en Node.js + Express + PostgreSQL para el Dashboard IoT.

## 🚀 Instalación y configuración

### 1. Instalar dependencias

```powershell
# Navegar a la carpeta del backend
cd "c:\Users\BITGAME\OneDrive\Documentos\GitHub\IoT\Back"

# Instalar dependencias de Node.js
npm install
```

### 2. Configurar base de datos

Asegúrate de que Docker esté ejecutándose y la base de datos PostgreSQL esté corriendo:

```powershell
# En la carpeta raíz del proyecto
cd "c:\Users\BITGAME\OneDrive\Documentos\GitHub\IoT"

# Iniciar PostgreSQL con Docker
docker-compose up -d

# Verificar que esté corriendo
docker ps
```

### 3. Ejecutar el backend

```powershell
# Modo desarrollo (con nodemon para auto-reload)
npm run dev

# O modo producción
npm start
```

## 📡 API Endpoints

### Salud del servidor
- `GET /api/health` - Estado del servidor y conexión a BD

### Dashboard
- `GET /api/dashboard` - Datos completos del dashboard
- `GET /api/dashboard/kpis` - Solo KPIs (endpoint ligero)
- `GET /api/dashboard/temperature-history` - Historial de temperatura

### Dispositivos (CRUD completo)
- `GET /api/devices` - Listar todos los dispositivos
- `GET /api/devices/:id` - Obtener dispositivo específico
- `POST /api/devices` - Crear nuevo dispositivo
- `PUT /api/devices/:id` - Actualizar dispositivo completo
- `PATCH /api/devices/:id` - Actualizar campos específicos
- `DELETE /api/devices/:id` - Eliminar dispositivo
- `GET /api/devices/stats/summary` - Estadísticas de dispositivos

## 🏗️ Estructura del proyecto

```
Back/
├── package.json         # Dependencias y scripts
├── server.js           # Servidor principal
├── routes/
│   ├── devices.js      # Rutas CRUD para dispositivos
│   └── dashboard.js    # Rutas para datos del dashboard
└── README.md          # Este archivo
```

## 🔧 Tecnologías utilizadas

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **pg** - Cliente PostgreSQL para Node.js
- **cors** - Middleware para CORS
- **dotenv** - Manejo de variables de entorno
- **nodemon** - Auto-reload en desarrollo

## 🌐 URLs importantes

Una vez ejecutando el backend:

- **API Base**: `http://localhost:3000/api`
- **Health Check**: `http://localhost:3000/api/health`
- **Dashboard**: `http://localhost:3000/api/dashboard`
- **Dispositivos**: `http://localhost:3000/api/devices`

## 🔄 Flujo de datos

```
Frontend (script.js) 
    ↓ HTTP Request
Backend (Express API)
    ↓ SQL Query  
PostgreSQL (Docker)
    ↓ Response
Backend (JSON)
    ↓ Response
Frontend (Dashboard Update)
```

## 🐛 Resolución de problemas

### Error de conexión a la base de datos
```
❌ Error conectando a PostgreSQL: connect ECONNREFUSED
```
**Solución**: Verificar que Docker esté ejecutándose y PostgreSQL esté activo:
```powershell
docker-compose up -d
docker ps
```

### Puerto ya en uso
```
Error: listen EADDRINUSE :::3000
```
**Solución**: Cambiar el puerto en el archivo `.env`:
```env
BACKEND_PORT=3001
```

### Tabla 'devices' no encontrada
```
⚠️ Tabla "devices" no encontrada
```
**Solución**: Reiniciar los contenedores de Docker:
```powershell
docker-compose down
docker-compose up -d
```

## 📊 Datos de ejemplo

El backend se conecta automáticamente a los datos insertados por el script SQL en [`../BaseDeDatos/init/consultas.sql`](../BaseDeDatos/init/consultas.sql).

## 🔒 Variables de entorno

El backend lee las variables del archivo [`.env`](../.env) en la raíz del proyecto:

- `DB_HOST` - Host de PostgreSQL
- `DB_PORT` - Puerto de PostgreSQL  
- `DB_NAME` - Nombre de la base de datos
- `DB_USER` - Usuario de PostgreSQL
- `DB_PASSWORD` - Contraseña de PostgreSQL
- `BACKEND_PORT` - Puerto del servidor backend

## ✅ Verificar funcionamiento

### 1. Verificar backend funcionando
```powershell
# Abrir en el navegador o usar curl
curl http://localhost:3000/api/health
```

### 2. Verificar datos del dashboard
```powershell
curl http://localhost:3000/api/dashboard
```

### 3. Verificar dispositivos
```powershell
curl http://localhost:3000/api/devices
```

## 🔗 Conexión con Frontend

El frontend en [`../Front/script.js`](../Front/script.js) está configurado para conectarse automáticamente a este backend. Si el backend no está disponible, el frontend usa datos simulados como fallback.

Para que funcione la conexión completa:
1. ✅ Base de datos corriendo (Docker)
2. ✅ Backend corriendo (Node.js)
3. ✅ Frontend abierto (index.html)





## pagina principal

http://localhost:8000/

**¡Todo listo para usar!** 🎉