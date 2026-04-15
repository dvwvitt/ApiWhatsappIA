#!/bin/bash

# ============================================
# ApiWhatsappIA — Lanzador con doble click
# Autor: Alejandro Hernandez (@alejo.hrndz)
# ============================================

# Ir al directorio del proyecto (donde esta este archivo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

clear
echo "========================================="
echo "   ApiWhatsappIA — Iniciando sistema..."
echo "========================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js no esta instalado."
    echo "Descargalo en: https://nodejs.org"
    echo ""
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

# Verificar .env
if [ ! -f ".env" ]; then
    echo "AVISO: No se encontro el archivo .env"
    echo "Copiando plantilla .env.example -> .env ..."
    cp .env.example .env
    echo ""
    echo "Abre el archivo .env y completa tus credenciales"
    echo "de Meta antes de volver a iniciar."
    echo ""
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

# Instalar dependencias si hace falta
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias (solo la primera vez)..."
    npm install
    echo ""
fi

# Detener servicios previos
echo "Deteniendo servicios anteriores..."
./scripts/stop-all.sh > /dev/null 2>&1
sleep 2

# Forzar liberación de puertos
echo "Verificando puertos disponibles..."
for port in 3000 3002 3004 5678; do
    PIDS=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "  Puerto $port ocupado — liberando..."
        echo "$PIDS" | xargs kill -9 2>/dev/null
    fi
done
sleep 2

# Crear carpetas necesarias
mkdir -p logs data

# Iniciar servicios
echo "Iniciando Middleware        (puerto 3000)..."
node src/servers/middleware.js > logs/middleware.log 2>&1 &
echo $! > logs/middleware.pid
sleep 2

echo "Iniciando Webhook Simple    (puerto 5678)..."
node src/servers/webhook-simple.js > logs/webhook.log 2>&1 &
echo $! > logs/webhook.pid
sleep 2

echo "Iniciando API Avanzada      (puerto 3004)..."
node src/servers/api-advanced.js > logs/api.log 2>&1 &
echo $! > logs/api.pid
sleep 2

echo "Iniciando Servidor Web      (puerto 3002)..."
node src/servers/web-server.js > logs/web-server.log 2>&1 &
echo $! > logs/web-server.pid
sleep 2

# Iniciar ngrok si esta disponible
if command -v ngrok &> /dev/null; then
    echo "Iniciando Ngrok             (tunel publico)..."
    pkill -f "ngrok http 3000" > /dev/null 2>&1
    ngrok http 3000 --log=stdout > logs/ngrok.log 2>&1 &
    echo $! > logs/ngrok.pid
    sleep 4
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null || echo "")
else
    NGROK_URL=""
fi

echo ""
echo "========================================="
echo "   SISTEMA LISTO"
echo "========================================="
echo ""
echo "  Dashboard:   http://localhost:3002/index.html"
echo "  API:         http://localhost:3004/api/status"
echo "  Middleware:  http://localhost:3000/health"
if [ -n "$NGROK_URL" ]; then
    echo "  Ngrok:       $NGROK_URL"
fi
echo ""

# Abrir el dashboard en el navegador predeterminado
echo "Abriendo dashboard en el navegador..."
sleep 1
open "http://localhost:3002/index.html"

echo ""
echo "Para detener la app cierra esta ventana"
echo "o ejecuta: ./scripts/stop-all.sh"
echo ""

# Mantener la terminal abierta mostrando logs
echo "--- Logs en tiempo real (Ctrl+C para salir) ---"
tail -f logs/middleware.log
