#!/bin/bash

# 🛑 SCRIPT PARA DETENER TODOS LOS SERVICIOS

echo "========================================="
echo "🛑 DETENIENDO SISTEMA UNIFICADO WHATSAPP"
echo "========================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Buscando servicios en ejecución...${NC}"

# Función para detener proceso por PID
stop_process() {
    local name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${BLUE}   Deteniendo $name (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null
            sleep 1
            
            if ps -p "$pid" > /dev/null 2>&1; then
                echo -e "${YELLOW}   ⚠️  Forzando detención...${NC}"
                kill -9 "$pid" 2>/dev/null
                sleep 1
            fi
            
            if ! ps -p "$pid" > /dev/null 2>&1; then
                echo -e "${GREEN}   ✅ $name detenido${NC}"
                rm -f "$pid_file"
            else
                echo -e "${RED}   ❌ No se pudo detener $name${NC}"
            fi
        else
            echo -e "${YELLOW}   ⚠️  $name no estaba en ejecución${NC}"
            rm -f "$pid_file"
        fi
    else
        echo -e "${YELLOW}   ⚠️  No hay PID file para $name${NC}"
    fi
}

# Detener servicios en orden inverso al inicio
echo ""
echo -e "${BLUE}1. Deteniendo Ngrok...${NC}"
pkill -f "ngrok http 3000" 2>/dev/null
stop_process "Ngrok" "logs/ngrok.pid"

echo ""
echo -e "${BLUE}2. Deteniendo Servidor Web...${NC}"
stop_process "Servidor Web" "logs/web-server.pid"

echo ""
echo -e "${BLUE}3. Deteniendo API Avanzada...${NC}"
stop_process "API Avanzada" "logs/api.pid"

echo ""
echo -e "${BLUE}4. Deteniendo Webhook Simple...${NC}"
stop_process "Webhook Simple" "logs/webhook.pid"

echo ""
echo -e "${BLUE}5. Deteniendo Middleware...${NC}"
stop_process "Middleware" "logs/middleware.pid"

# Detener cualquier otro proceso relacionado
echo ""
echo -e "${BLUE}6. Limpiando procesos residuales...${NC}"

# Buscar procesos Node.js relacionados
NODE_PROCESSES=$(ps aux | grep -E "(node.*(middleware|webhook|api|server)\.js|node.*src/)" | grep -v grep | awk '{print $2}')

if [ ! -z "$NODE_PROCESSES" ]; then
    echo -e "${YELLOW}   Encontrados procesos residuales:${NC}"
    for pid in $NODE_PROCESSES; do
        process_info=$(ps -p $pid -o command= 2>/dev/null || echo "Desconocido")
        echo -e "   PID $pid: $process_info"
        kill $pid 2>/dev/null
    done
    sleep 1
fi

# Verificar puertos
echo ""
echo -e "${BLUE}7. Verificando puertos liberados...${NC}"

PORTS="3000 3002 3004 5678"
for port in $PORTS; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${RED}   ❌ Puerto $port aún en uso${NC}"
        # Forzar liberación
        lsof -ti:$port | xargs kill -9 2>/dev/null
    else
        echo -e "${GREEN}   ✅ Puerto $port liberado${NC}"
    fi
done

# Limpiar archivos PID
echo ""
echo -e "${BLUE}8. Limpiando archivos temporales...${NC}"
rm -f logs/*.pid 2>/dev/null
rm -f logs/pids.info 2>/dev/null

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ TODOS LOS SERVICIOS DETENIDOS${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

echo -e "${BLUE}📊 Estado final:${NC}"
echo -e "   Middleware (3000):   $(lsof -ti:3000 > /dev/null && echo -e "${RED}❌ Activo${NC}" || echo -e "${GREEN}✅ Detenido${NC}")"
echo -e "   Web Server (3002):   $(lsof -ti:3002 > /dev/null && echo -e "${RED}❌ Activo${NC}" || echo -e "${GREEN}✅ Detenido${NC}")"
echo -e "   API (3004):          $(lsof -ti:3004 > /dev/null && echo -e "${RED}❌ Activo${NC}" || echo -e "${GREEN}✅ Detenido${NC}")"
echo -e "   Webhook (5678):      $(lsof -ti:5678 > /dev/null && echo -e "${RED}❌ Activo${NC}" || echo -e "${GREEN}✅ Detenido${NC}")"

echo ""
echo -e "${YELLOW}⚠️  Para reiniciar: ./scripts/start-all.sh${NC}"