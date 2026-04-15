#!/bin/bash

# 📊 SCRIPT PARA VERIFICAR ESTADO DEL SISTEMA UNIFICADO

echo "========================================="
echo "📊 ESTADO DEL SISTEMA UNIFICADO WHATSAPP"
echo "========================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Función para verificar puerto
check_port() {
    local port=$1
    local service=$2
    local url=$3
    
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${service} (puerto ${port}) - ACTIVO${NC}"
        if [ ! -z "$url" ]; then
            echo -e "   ${CYAN}🔗 ${url}${NC}"
            
            # Intentar health check si existe endpoint
            if [[ $url == http* ]]; then
                if curl -s --max-time 2 "${url}/health" > /dev/null 2>&1; then
                    echo -e "   ${GREEN}   Health check: OK${NC}"
                elif curl -s --max-time 2 "$url" > /dev/null 2>&1; then
                    echo -e "   ${GREEN}   Respuesta: OK${NC}"
                else
                    echo -e "   ${YELLOW}   ⚠️  Sin respuesta health check${NC}"
                fi
            fi
        fi
    else
        echo -e "${RED}❌ ${service} (puerto ${port}) - INACTIVO${NC}"
    fi
}

# Función para verificar PID file
check_pid_file() {
    local service=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        if [ ! -z "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${GREEN}   PID file: ${pid} (ACTIVO)${NC}"
        else
            echo -e "${RED}   PID file: ${pid} (INACTIVO o inválido)${NC}"
            echo -e "${YELLOW}   💡 Eliminar: rm -f ${pid_file}${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  No hay PID file${NC}"
    fi
}

# Función para mostrar logs recientes
show_recent_logs() {
    local service=$1
    local log_file=$2
    local lines=${3:-5}
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}   Últimas ${lines} líneas de log:${NC}"
        tail -n $lines "$log_file" | sed 's/^/   /'
    else
        echo -e "${YELLOW}   ⚠️  No hay archivo de log${NC}"
    fi
}

echo ""
echo -e "${MAGENTA}🔍 VERIFICANDO SERVICIOS:${NC}"
echo ""

# 1. Middleware (puerto 3000)
echo -e "${BLUE}1. Middleware Principal:${NC}"
check_port 3000 "Middleware" "http://localhost:3000/health"
check_pid_file "Middleware" "logs/middleware.pid"
show_recent_logs "Middleware" "logs/middleware.log" 3

# 2. Servidor Web (puerto 3002)
echo ""
echo -e "${BLUE}2. Servidor Web (Paneles):${NC}"
check_port 3002 "Servidor Web" "http://localhost:3002"
check_pid_file "Servidor Web" "logs/web-server.pid"
show_recent_logs "Servidor Web" "logs/web-server.log" 2

# 3. API Avanzada (puerto 3004)
echo ""
echo -e "${BLUE}3. API Avanzada:${NC}"
check_port 3004 "API Avanzada" "http://localhost:3004"
check_pid_file "API Avanzada" "logs/api.pid"
show_recent_logs "API Avanzada" "logs/api.log" 2

# 4. Webhook Simple (puerto 5678)
echo ""
echo -e "${BLUE}4. Webhook Simple:${NC}"
check_port 5678 "Webhook Simple" "http://localhost:5678"
check_pid_file "Webhook Simple" "logs/webhook.pid"
show_recent_logs "Webhook Simple" "logs/webhook.log" 2

# 5. Ngrok
echo ""
echo -e "${BLUE}5. Ngrok (Túnel Público):${NC}"
if [ -f "logs/ngrok.pid" ]; then
    NGROK_PID=$(cat logs/ngrok.pid 2>/dev/null)
    if [ ! -z "$NGROK_PID" ] && ps -p "$NGROK_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ngrok - ACTIVO (PID: ${NGROK_PID})${NC}"
        
        # Obtener URL pública
        NGROK_URL=$(curl -s --max-time 2 http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
        if [ ! -z "$NGROK_URL" ] && [ "$NGROK_URL" != "null" ]; then
            echo -e "${CYAN}   🔗 URL Pública: ${NGROK_URL}${NC}"
            echo -e "${CYAN}   🔗 Webhook: ${NGROK_URL}/webhook/whatsapp${NC}"
        else
            echo -e "${YELLOW}   ⚠️  No se pudo obtener URL pública${NC}"
        fi
    else
        echo -e "${RED}❌ Ngrok - INACTIVO${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Ngrok - NO CONFIGURADO${NC}"
    echo -e "${YELLOW}   💡 Instalar: brew install ngrok${NC}"
    echo -e "${YELLOW}   💡 Configurar: ngrok authtoken <TU_TOKEN>${NC}"
fi

echo ""
echo -e "${MAGENTA}📊 DATOS DEL SISTEMA:${NC}"
echo ""

# Verificar archivos de datos
echo -e "${BLUE}Archivos de datos:${NC}"

if [ -f "data/messages.json" ]; then
    MSG_COUNT=$(jq '. | length' data/messages.json 2>/dev/null || echo "Error")
    echo -e "${GREEN}✅ messages.json: ${MSG_COUNT} mensajes${NC}"
    
    # Último mensaje
    LAST_MSG=$(jq -r '.[-1] | "\(.from): \(.text)"' data/messages.json 2>/dev/null || echo "N/A")
    LAST_TIME=$(jq -r '.[-1].timestamp' data/messages.json 2>/dev/null | cut -d'T' -f1 2>/dev/null || echo "N/A")
    echo -e "   ${CYAN}Último: ${LAST_MSG} (${LAST_TIME})${NC}"
else
    echo -e "${RED}❌ messages.json: NO EXISTE${NC}"
fi

if [ -f "data/responses.json" ]; then
    RESP_COUNT=$(jq '. | length' data/responses.json 2>/dev/null || echo "Error")
    echo -e "${GREEN}✅ responses.json: ${RESP_COUNT} respuestas${NC}"
    
    # Intenciones únicas
    INTENTS=$(jq -r '[.[].intent] | unique | length' data/responses.json 2>/dev/null || echo "0")
    echo -e "   ${CYAN}Intenciones únicas: ${INTENTS}${NC}"
else
    echo -e "${RED}❌ responses.json: NO EXISTE${NC}"
fi

# Verificar backups
BACKUP_COUNT=$(find data/ -name "*.backup.*" -o -name "*.json.backup*" 2>/dev/null | wc -l)
if [ $BACKUP_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Backups: ${BACKUP_COUNT} archivos de backup${NC}"
else
    echo -e "${YELLOW}⚠️  Backups: No hay backups recientes${NC}"
fi

echo ""
echo -e "${MAGENTA}🌐 URLs DISPONIBLES:${NC}"
echo ""

echo -e "${CYAN}PANELES:${NC}"
echo -e "   ${YELLOW}http://localhost:3002/index.html${NC}        (Dashboard completo)"
echo -e "   ${YELLOW}http://localhost:3002/simple-index.html${NC} (Panel simple)"

echo ""
echo -e "${CYAN}🔧 HERRAMIENTAS DE DESARROLLO:${NC}"
echo -e "   ${YELLOW}http://localhost:3000/health${NC}           (Health check middleware)"
echo -e "   ${YELLOW}http://localhost:3004${NC}                  (API avanzada)"
echo -e "   ${YELLOW}http://localhost:5678${NC}                  (Webhook simple)"
echo -e "   ${YELLOW}http://localhost:4040${NC}                  (Dashboard Ngrok)"

echo ""
echo -e "${MAGENTA}📱 WHATSAPP BUSINESS:${NC}"
echo ""
echo -e "${CYAN}Número de WhatsApp:${NC}"
echo -e "   ${YELLOW}+573123080083${NC}"
echo ""
echo -e "${CYAN}Mensajes de prueba:${NC}"
echo -e "   ${YELLOW}1. \"Hola\"${NC}"
echo -e "   ${YELLOW}2. \"¿A qué hora abren?\"${NC}"
echo -e "   ${YELLOW}3. \"¿Dónde están ubicados?\"${NC}"
echo -e "   ${YELLOW}4. \"Necesito cambiar una batería\"${NC}"

echo ""
echo -e "${MAGENTA}🔧 COMANDOS RÁPIDOS:${NC}"
echo ""
echo -e "${CYAN}Iniciar todo:${NC}"
echo -e "   ${YELLOW}./scripts/start-all.sh${NC}"
echo ""
echo -e "${CYAN}Detener todo:${NC}"
echo -e "   ${YELLOW}./scripts/stop-all.sh${NC}"
echo ""
echo -e "${CYAN}Ver logs en tiempo real:${NC}"
echo -e "   ${YELLOW}tail -f logs/middleware.log${NC}"
echo ""
echo -e "${CYAN}Abrir panel en navegador:${NC}"
echo -e "   ${YELLOW}open http://localhost:3002/index.html${NC}"

echo ""
echo -e "${MAGENTA}📈 ESTADÍSTICAS RÁPIDAS:${NC}"
echo ""

# Calcular algunas estadísticas
if [ -f "data/messages.json" ] && [ -f "data/responses.json" ]; then
    TOTAL_MSGS=$(jq '. | length' data/messages.json 2>/dev/null || echo 0)
    TOTAL_RESPS=$(jq '. | length' data/responses.json 2>/dev/null || echo 0)
    
    # Mensajes respondidos
    RESPONDED_MSGS=$(jq '[.[] | select(.response_sent)] | length' data/messages.json 2>/dev/null || echo 0)
    
    if [ $TOTAL_MSGS -gt 0 ]; then
        SUCCESS_RATE=$((RESPONDED_MSGS * 100 / TOTAL_MSGS))
    else
        SUCCESS_RATE=0
    fi
    
    echo -e "${CYAN}Tasa de éxito:${NC} ${YELLOW}${SUCCESS_RATE}%${NC} (${RESPONDED_MSGS}/${TOTAL_MSGS} mensajes respondidos)"
    echo -e "${CYAN}Respuestas configuradas:${NC} ${YELLOW}${TOTAL_RESPS}${NC}"
    
    # Intención más popular
    POPULAR_INTENT=$(jq -r 'group_by(.intent) | max_by(length) | .[0].intent' data/messages.json 2>/dev/null || echo "N/A")
    echo -e "${CYAN}Intención más popular:${NC} ${YELLOW}${POPULAR_INTENT}${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ VERIFICACIÓN COMPLETADA${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# Resumen final
ACTIVE_PORTS=$(lsof -ti:3000,3002,3004,5678 2>/dev/null | wc -l | tr -d ' ')
TOTAL_PORTS=4

if [ $ACTIVE_PORTS -eq $TOTAL_PORTS ]; then
    echo -e "${GREEN}🎉 TODOS LOS SERVICIOS ESTÁN ACTIVOS${NC}"
elif [ $ACTIVE_PORTS -eq 0 ]; then
    echo -e "${RED}🚨 NINGÚN SERVICIO ACTIVO${NC}"
    echo -e "${YELLOW}💡 Ejecuta: ./scripts/start-all.sh${NC}"
else
    echo -e "${YELLOW}⚠️  ${ACTIVE_PORTS}/${TOTAL_PORTS} SERVICIOS ACTIVOS${NC}"
    echo -e "${YELLOW}💡 Para iniciar todos: ./scripts/start-all.sh${NC}"
fi

echo ""