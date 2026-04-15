#!/bin/bash

# 🚀 SCRIPT PARA INICIAR TODOS LOS SERVICIOS
# Proyecto Unificado WhatsApp Business API

echo "========================================="
echo "🚀 INICIANDO SISTEMA UNIFICADO WHATSAPP"
echo "========================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Verificando dependencias...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Instalando dependencias...${NC}"
    npm install
fi

# Crear directorios necesarios
mkdir -p logs data

echo -e "${BLUE}🔧 Configurando entorno...${NC}"

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Creando archivo .env desde ejemplo...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Por favor configura las variables en .env${NC}"
    else
        echo -e "${RED}❌ No hay archivo .env.example${NC}"
    fi
fi

echo -e "${GREEN}✅ Dependencias verificadas${NC}"
echo ""

# Detener servicios previos si existen
echo -e "${BLUE}🛑 Deteniendo servicios previos...${NC}"
./scripts/stop-all.sh
sleep 2

echo ""
echo -e "${BLUE}🚀 Iniciando servicios...${NC}"
echo ""

# 1. Middleware principal (puerto 3000)
echo -e "${BLUE}1. Iniciando Middleware (puerto 3000)...${NC}"
node src/servers/middleware.js > logs/middleware.log 2>&1 &
MIDDLEWARE_PID=$!
echo $MIDDLEWARE_PID > logs/middleware.pid
sleep 2

if ps -p $MIDDLEWARE_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Middleware iniciado (PID: $MIDDLEWARE_PID)${NC}"
else
    echo -e "${RED}   ❌ Error iniciando Middleware${NC}"
    tail -n 10 logs/middleware.log
    exit 1
fi

# 2. Webhook simple (puerto 5678)
echo -e "${BLUE}2. Iniciando Webhook Simple (puerto 5678)...${NC}"
node src/servers/webhook-simple.js > logs/webhook.log 2>&1 &
WEBHOOK_PID=$!
echo $WEBHOOK_PID > logs/webhook.pid
sleep 2

if ps -p $WEBHOOK_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Webhook Simple iniciado (PID: $WEBHOOK_PID)${NC}"
else
    echo -e "${RED}   ❌ Error iniciando Webhook Simple${NC}"
    tail -n 10 logs/webhook.log
    exit 1
fi

# 3. API Avanzada (puerto 3004)
echo -e "${BLUE}3. Iniciando API Avanzada (puerto 3004)...${NC}"
node src/servers/api-advanced.js > logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > logs/api.pid
sleep 2

if ps -p $API_PID > /dev/null; then
    echo -e "${GREEN}   ✅ API Avanzada iniciada (PID: $API_PID)${NC}"
else
    echo -e "${RED}   ❌ Error iniciando API Avanzada${NC}"
    tail -n 10 logs/api.log
    exit 1
fi

# 4. Servidor Web (puerto 3002)
echo -e "${BLUE}4. Iniciando Servidor Web (puerto 3002)...${NC}"
node src/servers/web-server.js > logs/web-server.log 2>&1 &
WEB_SERVER_PID=$!
echo $WEB_SERVER_PID > logs/web-server.pid
sleep 2

if ps -p $WEB_SERVER_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Servidor Web iniciado (PID: $WEB_SERVER_PID)${NC}"
else
    echo -e "${RED}   ❌ Error iniciando Servidor Web${NC}"
    tail -n 10 logs/web-server.log
    exit 1
fi

# 5. Ngrok (túnel público)
echo -e "${BLUE}5. Configurando Ngrok...${NC}"
if command -v ngrok &> /dev/null; then
    # Detener ngrok previo
    pkill -f "ngrok http 3000" 2>/dev/null
    sleep 1
    
    # Iniciar ngrok en background
    ngrok http 3000 --log=stdout > logs/ngrok.log 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > logs/ngrok.pid
    sleep 3
    
    if ps -p $NGROK_PID > /dev/null; then
        echo -e "${GREEN}   ✅ Ngrok iniciado (PID: $NGROK_PID)${NC}"
        
        # Obtener URL pública
        sleep 2
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "No disponible")
        echo -e "${BLUE}   🌐 URL Pública: ${NGROK_URL}${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Ngrok no pudo iniciarse (puede que no esté instalado)${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  Ngrok no está instalado. Instala con: brew install ngrok${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ TODOS LOS SERVICIOS INICIADOS${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# Mostrar URLs
echo -e "${BLUE}URLs DISPONIBLES:${NC}"
echo -e "   Dashboard:         ${YELLOW}http://localhost:3002/index.html${NC}"
echo -e "   Panel Simple:      ${YELLOW}http://localhost:3002/simple-index.html${NC}"
echo -e "   API Avanzada:      ${YELLOW}http://localhost:3004${NC}"
echo -e "   Middleware:        ${YELLOW}http://localhost:3000/health${NC}"
echo -e "   Webhook Simple:    ${YELLOW}http://localhost:5678${NC}"

if [ ! -z "$NGROK_URL" ] && [ "$NGROK_URL" != "No disponible" ]; then
    echo -e "   Ngrok Público:     ${YELLOW}${NGROK_URL}${NC}"
fi

echo ""
echo -e "${BLUE}📊 DATOS:${NC}"
echo -e "   Mensajes:          ${YELLOW}$(wc -l data/messages.json 2>/dev/null | awk '{print $1}' || echo "0")${NC}"
echo -e "   Respuestas:        ${YELLOW}$(jq '. | length' data/responses.json 2>/dev/null || echo "0")${NC}"

echo ""
echo -e "${BLUE}🔧 COMANDOS ÚTILES:${NC}"
echo -e "   Ver estado:        ${YELLOW}./scripts/check-status.sh${NC}"
echo -e "   Detener todo:      ${YELLOW}./scripts/stop-all.sh${NC}"
echo -e "   Ver logs:          ${YELLOW}tail -f logs/middleware.log${NC}"
echo -e "   Abrir panel:       ${YELLOW}open http://localhost:3002/index.html${NC}"

echo ""
echo -e "${GREEN}🚀 Sistema listo para usar!${NC}"
echo ""

# Guardar información de PIDs
cat > logs/pids.info << EOF
Middleware: $MIDDLEWARE_PID
Webhook: $WEBHOOK_PID
API: $API_PID
Web Server: $WEB_SERVER_PID
Ngrok: $NGROK_PID
EOF

echo -e "${BLUE}📝 PIDs guardados en: logs/pids.info${NC}"