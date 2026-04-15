#!/bin/bash

# ============================================
# ApiWhatsappIA — Lanzador Linux
# Autor: Alejandro Hernandez (@alejo.hrndz)
# ============================================

# Ir al directorio del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo "========================================="
echo "   ApiWhatsappIA — Verificando sistema..."
echo "========================================="
echo ""

ERRORES=0
AVISOS=0

# -----------------------------------------------
# VERIFICAR NODE.JS
# -----------------------------------------------
if ! command -v node &> /dev/null; then
    echo -e "${RED}[X] Node.js        NO encontrado${NC}"
    ERRORES=1
else
    NODE_VER=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${YELLOW}[!] Node.js        encontrado ($NODE_VER) pero se requiere v18 o superior${NC}"
        ERRORES=1
    else
        echo -e "${GREEN}[OK] Node.js       $NODE_VER${NC}"
    fi
fi

# -----------------------------------------------
# VERIFICAR NPM
# -----------------------------------------------
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[X] npm            NO encontrado${NC}"
    ERRORES=1
else
    echo -e "${GREEN}[OK] npm           v$(npm -v)${NC}"
fi

# -----------------------------------------------
# VERIFICAR CURL
# -----------------------------------------------
if ! command -v curl &> /dev/null; then
    echo -e "${RED}[X] curl           NO encontrado${NC}"
    ERRORES=1
else
    echo -e "${GREEN}[OK] curl          disponible${NC}"
fi

# -----------------------------------------------
# VERIFICAR NGROK (opcional)
# -----------------------------------------------
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}[!] ngrok          NO encontrado (necesario para recibir mensajes externos)${NC}"
    AVISOS=1
else
    echo -e "${GREEN}[OK] ngrok         disponible${NC}"
fi

echo ""

# -----------------------------------------------
# SI HAY ERRORES: MOSTRAR GUIA Y SALIR
# -----------------------------------------------
if [ "$ERRORES" -eq 1 ]; then
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}   FALTAN HERRAMIENTAS REQUERIDAS${NC}"
    echo -e "${RED}=========================================${NC}"
    echo ""
    echo "  Sigue estos pasos para instalar lo necesario:"
    echo ""

    if ! command -v node &> /dev/null || [ "${NODE_MAJOR:-0}" -lt 18 ]; then
        echo -e "${BLUE}  1. NODE.JS (requerido)${NC}"
        echo "     Opcion A — Con gestor de versiones (recomendado):"
        echo "       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
        echo "       source ~/.bashrc   # o source ~/.zshrc"
        echo "       nvm install 18"
        echo "       nvm use 18"
        echo ""
        echo "     Opcion B — Desde el gestor de paquetes del sistema:"
        echo "       Ubuntu/Debian:"
        echo "         curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "         sudo apt-get install -y nodejs"
        echo ""
        echo "       Fedora/RHEL:"
        echo "         curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -"
        echo "         sudo dnf install nodejs"
        echo ""
        echo "       Arch Linux:"
        echo "         sudo pacman -S nodejs npm"
        echo ""
    fi

    if ! command -v curl &> /dev/null; then
        echo -e "${BLUE}  2. CURL (requerido)${NC}"
        echo "     Ubuntu/Debian:  sudo apt-get install curl"
        echo "     Fedora/RHEL:    sudo dnf install curl"
        echo "     Arch:           sudo pacman -S curl"
        echo ""
    fi

    echo "  Despues de instalar todo, vuelve a ejecutar este archivo:"
    echo "    bash \"Iniciar App.sh\""
    echo ""
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

# -----------------------------------------------
# AVISO DE NGROK SI NO ESTA
# -----------------------------------------------
if [ "$AVISOS" -eq 1 ]; then
    echo -e "${YELLOW}  AVISO: ngrok no esta instalado.${NC}"
    echo "  Sin ngrok la app funciona en local pero NO recibira mensajes"
    echo "  de WhatsApp desde internet."
    echo ""
    echo "  Para instalarlo:"
    echo "    Ubuntu/Debian:"
    echo "      curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null"
    echo "      echo \"deb https://ngrok-agent.s3.amazonaws.com buster main\" | sudo tee /etc/apt/sources.list.d/ngrok.list"
    echo "      sudo apt update && sudo apt install ngrok"
    echo ""
    echo "    Arch Linux:"
    echo "      yay -S ngrok  # o descarga el binario en https://ngrok.com/download"
    echo ""
    echo -n "  Continuar sin ngrok? [s/N]: "
    read -r RESP
    if [[ ! "$RESP" =~ ^[sS]$ ]]; then
        echo "Saliendo. Instala ngrok y vuelve a ejecutar."
        exit 0
    fi
    echo ""
fi

# -----------------------------------------------
# VERIFICAR ARCHIVO .env
# -----------------------------------------------
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Archivo .env no encontrado. Creando desde plantilla...${NC}"
    cp .env.example .env
    echo ""
    echo "  Abre el archivo .env y completa tus credenciales de Meta:"
    echo ""
    echo "    M4D_APP_ID"
    echo "    M4D_APP_SECRET"
    echo "    WA_PHONE_NUMBER_ID"
    echo "    WA_BUSINESS_ACCOUNT_ID"
    echo "    CLOUD_API_ACCESS_TOKEN"
    echo "    WEBHOOK_VERIFICATION_TOKEN"
    echo ""
    echo "  Edita con: nano .env"
    echo ""
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

# -----------------------------------------------
# INSTALAR DEPENDENCIAS SI HACE FALTA
# -----------------------------------------------
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Instalando dependencias (solo la primera vez)...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error al instalar dependencias. Revisa tu conexion.${NC}"
        read -p "Presiona Enter para cerrar..."
        exit 1
    fi
    echo ""
fi

# -----------------------------------------------
# PERMISOS DE SCRIPTS
# -----------------------------------------------
chmod +x scripts/start-all.sh scripts/stop-all.sh scripts/check-status.sh 2>/dev/null

# -----------------------------------------------
# DETENER SERVICIOS PREVIOS
# -----------------------------------------------
echo -e "${BLUE}Deteniendo servicios anteriores...${NC}"
./scripts/stop-all.sh > /dev/null 2>&1
sleep 2

mkdir -p logs data

# -----------------------------------------------
# INICIAR SERVICIOS
# -----------------------------------------------
echo ""
echo -e "${BLUE}Iniciando servicios...${NC}"
echo ""

echo "  Middleware        (puerto 3000)..."
node src/servers/middleware.js > logs/middleware.log 2>&1 &
echo $! > logs/middleware.pid
sleep 2

echo "  Webhook Simple    (puerto 5678)..."
node src/servers/webhook-simple.js > logs/webhook.log 2>&1 &
echo $! > logs/webhook.pid
sleep 2

echo "  API Avanzada      (puerto 3004)..."
node src/servers/api-advanced.js > logs/api.log 2>&1 &
echo $! > logs/api.pid
sleep 2

echo "  Servidor Web      (puerto 3002)..."
node src/servers/web-server.js > logs/web-server.log 2>&1 &
echo $! > logs/web-server.pid
sleep 2

# -----------------------------------------------
# INICIAR NGROK SI ESTA DISPONIBLE
# -----------------------------------------------
if command -v ngrok &> /dev/null; then
    echo "  Ngrok             (tunel publico)..."
    pkill -f "ngrok http 3000" > /dev/null 2>&1
    ngrok http 3000 --log=stdout > logs/ngrok.log 2>&1 &
    echo $! > logs/ngrok.pid
    sleep 4
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null || echo "")
fi

# -----------------------------------------------
# ABRIR NAVEGADOR
# -----------------------------------------------
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   SISTEMA LISTO${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "  Dashboard:   ${YELLOW}http://localhost:3002/index.html${NC}"
echo -e "  API:         ${YELLOW}http://localhost:3004/api/status${NC}"
echo -e "  Middleware:  ${YELLOW}http://localhost:3000/health${NC}"
if [ -n "$NGROK_URL" ]; then
    echo -e "  Ngrok:       ${YELLOW}$NGROK_URL${NC}"
fi
echo ""

echo "Abriendo dashboard en el navegador..."
sleep 1

# Detectar el comando correcto para abrir el navegador en Linux
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3002/index.html" &
elif command -v gnome-open &> /dev/null; then
    gnome-open "http://localhost:3002/index.html" &
elif command -v firefox &> /dev/null; then
    firefox "http://localhost:3002/index.html" &
elif command -v google-chrome &> /dev/null; then
    google-chrome "http://localhost:3002/index.html" &
elif command -v chromium-browser &> /dev/null; then
    chromium-browser "http://localhost:3002/index.html" &
else
    echo -e "${YELLOW}  Abre manualmente: http://localhost:3002/index.html${NC}"
fi

echo ""
echo "Para detener la app ejecuta: ./scripts/stop-all.sh"
echo "--- Logs en tiempo real (Ctrl+C para salir) ---"
echo ""
tail -f logs/middleware.log
