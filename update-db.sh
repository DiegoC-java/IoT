#!/bin/bash

# Script de actualización de base de datos para proyecto IoT
# Ejecuta todas las migraciones SQL en orden

echo "🔄 ======================================"
echo "   Actualizando Base de Datos IoT"
echo "🔄 ======================================"
echo ""

# Verificar que Docker esté corriendo
if ! docker ps &> /dev/null; then
    echo "❌ Error: Docker no está corriendo o no tienes permisos"
    echo "   Solución: Inicia Docker Desktop o ejecuta con sudo"
    exit 1
fi

# Verificar que el contenedor de PostgreSQL esté corriendo
if ! docker ps | grep -q iot_postgres; then
    echo "❌ Error: El contenedor iot_postgres no está corriendo"
    echo "   Solución: Ejecuta 'docker-compose up -d' primero"
    exit 1
fi

echo "✅ Contenedor PostgreSQL detectado"
echo ""

# Directorio de migraciones
MIGRATIONS_DIR="BaseDeDatos/init"

# Verificar que exista el directorio
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Error: No se encuentra el directorio $MIGRATIONS_DIR"
    exit 1
fi

# Contador de migraciones
TOTAL=0
SUCCESS=0
FAILED=0

echo "📂 Ejecutando migraciones desde: $MIGRATIONS_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ejecutar cada archivo .sql en orden alfabético
for migration in $(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | sort); do
    TOTAL=$((TOTAL + 1))
    FILENAME=$(basename "$migration")
    
    echo "⏳ Ejecutando: $FILENAME"
    
    # Ejecutar migración y capturar salida
    if docker exec -i iot_postgres psql -U iot_user -d iot_dashboard < "$migration" > /dev/null 2>&1; then
        echo "   ✅ OK"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "   ⚠️  Error (puede ser que ya esté aplicada)"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Resumen:"
echo "   Total de archivos: $TOTAL"
echo "   Exitosos: $SUCCESS"
echo "   Con advertencias: $FAILED"
echo ""

if [ $TOTAL -eq 0 ]; then
    echo "⚠️  No se encontraron archivos .sql en $MIGRATIONS_DIR"
    exit 1
fi

echo "✅ Actualización de base de datos completada"
echo ""
echo "💡 Próximos pasos:"
echo "   1. Reinicia el backend: cd Back && npm run dev"
echo "   2. Refresca el frontend en el navegador"
echo ""
