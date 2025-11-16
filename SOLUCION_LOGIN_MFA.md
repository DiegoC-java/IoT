# 🔐 SOLUCIONAR PROBLEMA DE LOGIN MFA

## El Problema
Cuando registras un usuario CON MFA y luego intentas hacer login, no aparece el campo para ingresar el código MFA. Solo sale "Usuario o contraseña incorrectos".

## ✅ Solución - 3 Pasos

### Paso 1: Diagnóstico
Abre esta URL en tu navegador (Firefox, Chrome, etc):
```
http://localhost:8000/Front/debug-firefox.html
```

En esa página:
1. Haz clic en "Test Conexión Backend" - debe decir ✅
2. Ingresa usuario: `messi` y contraseña: `123456`
3. Haz clic en "Test Login"
4. Si ves `mfaRequired: true`, copia el email
5. Revisa tu email para obtener el código MFA
6. Pega el código en la página de debug y valida

### Paso 2: Si el debug funciona correctamente
Significa que el BACKEND está bien. Entonces el problema es en el FRONTEND (login.html).

En ese caso, abre en tu navegador:
```
http://localhost:8000/Front/login.html
```

Con las developer tools (F12):
1. Abre la pestaña "Console"
2. Intenta hacer login con usuario `messi` y contraseña `123456`
3. Mira qué dice en la consola - ¿hay errores?
4. ¿Dice algo sobre "MFA requerido"?

### Paso 3: Solucionar según los resultados

**Si en debug funciona pero en login.html no:**
- Cierra y abre nuevamente login.html (Ctrl+F5 para limpiar caché)
- Revisa la consola (F12) para ver errores de JavaScript

**Si en debug aparece error de conexión:**
- Verifica que el backend está corriendo: `npm run dev` en carpeta `/Back`
- Verifica que PostgreSQL está corriendo: `docker ps | grep postgres`

## 📞 Información que necesito

Cuando me reportes el problema, por favor incluye:

1. **Resultado del debug (debug-firefox.html)**
   - ¿Qué dice en cada paso?
   - ¿Hay errores?

2. **Errors en consola (F12 → Console)**
   - ¿Qué dice exactamente?

3. **Respuesta exacta en login.html**
   - ¿Qué error muestra?

Con esa información podré arreglarlo rápidamente.

---

## URLs rápidas

| Página | URL |
|--------|-----|
| Login Normal | http://localhost:8000/Front/login.html |
| Debug MFA | http://localhost:8000/Front/debug-firefox.html |
| Registro | http://localhost:8000/Front/register.html |
| Dashboard | http://localhost:8000/Front/index.html |
| Benchmarks | http://localhost:8000/Front/benchmarks.html |
