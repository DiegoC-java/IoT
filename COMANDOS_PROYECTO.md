# Comandos útiles para el proyecto IoT

## Git

- Agregar todos los cambios:
```bash
git add .
```
- Guardar los cambios con mensaje:
```bash
git commit -m "Tu mensaje de commit"
```
- Traer cambios del repositorio remoto:
```bash
git pull
```
- Subir tus cambios al repositorio remoto:
```bash
git push
```
- Actualizar referencias remotas:
```bash
git fetch origin
```

## Backend

- Instalar dependencias (solo la primera vez o si hay cambios en package.json):
```bash
cd Back
npm install
```
- Iniciar el backend:
```bash
npm run dev
```
O si no tienes nodemon:
```bash
node server.js
```

## Docker y PostgreSQL

- Levantar los servicios con Docker:
```bash
docker-compose up -d
```
- Ver el estado de los contenedores:
```bash
docker ps
```
- Detener los servicios:
```bash
docker-compose down
```

## PostgreSQL (local)

- Conectarse como usuario postgres:
```bash
sudo -u postgres psql
```
- Conectarse como usuario específico:
```bash
psql -U iot_user -d iot_dashboard
```
- Ejecutar un script SQL:
```sql
\i /ruta/al/archivo.sql
```
- Salir de la consola de psql:
```sql
\q
```

## Solución de problemas de permisos

### Backend (npm run dev)

Si ves "Permiso denegado" al ejecutar npm o nodemon:
```bash
chmod +x node_modules/.bin/nodemon
```
Si el problema es con otro archivo, reemplaza `nodemon` por el nombre del archivo.

### Docker

Si ves errores de permisos con Docker, ejecuta el comando con sudo:
```bash
sudo docker-compose up -d
```
```bash
sudo docker ps
```
```bash
sudo docker-compose down
```
Para evitar usar sudo cada vez, agrega tu usuario al grupo docker (requiere cerrar sesión o reiniciar):
```bash
sudo usermod -aG docker $USER
```

## Frontend

- Levantar servidor estático con Python:
```bash
cd Front
python3 -m http.server 8080
```
(Si el puerto 8080 está ocupado, usa otro: `python3 -m http.server 8081`)

- Alternativamente, abre `index.html` directamente en tu navegador.

---

**Recuerda ejecutar los comandos en la carpeta raíz del proyecto o en la carpeta correspondiente.**
