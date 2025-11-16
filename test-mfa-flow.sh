#!/bin/bash

echo "🧪 PRUEBA DE FLUJO MFA"
echo "====================="

# Test 1: Check-MFA para usuario sin MFA
echo ""
echo "1️⃣ Verificando estado MFA para usuario papito (sin MFA)..."
curl -s -X GET http://localhost:3000/api/auth/check-mfa/papito \
    -H "Content-Type: application/json" | jq .

# Test 2: Login usuario papito (sin MFA)
echo ""
echo "2️⃣ Login para usuario papito (sin MFA)..."
curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"papito","password":"123456"}' | jq .

# Test 3: Check-MFA para usuario CON MFA
echo ""
echo "3️⃣ Verificando estado MFA para usuario ojito (con MFA)..."
curl -s -X GET http://localhost:3000/api/auth/check-mfa/ojito \
    -H "Content-Type: application/json" | jq .

# Test 4: Login usuario ojito (debe pedir MFA)
echo ""
echo "4️⃣ Login para usuario ojito (debe pedir MFA)..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"ojito","password":"Diegomessi123456"}')
echo "$LOGIN_RESPONSE" | jq .

echo ""
echo "5️⃣ Verificando benchmarks..."
curl -s -X GET http://localhost:3000/api/benchmarks/stats | jq .

echo ""
echo "✅ Pruebas completadas"
