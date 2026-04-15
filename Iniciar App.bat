@echo off
chcp 65001 >nul
title ApiWhatsappIA — Lanzador

echo =========================================
echo    ApiWhatsappIA — Verificando sistema...
echo =========================================
echo.

set ERRORES=0

:: -----------------------------------------------
:: VERIFICAR NODE.JS
:: -----------------------------------------------
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js NO encontrado
    set ERRORES=1
) else (
    for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
    echo [OK] Node.js encontrado: %NODE_VER%
)

:: -----------------------------------------------
:: VERIFICAR NPM
:: -----------------------------------------------
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] npm NO encontrado
    set ERRORES=1
) else (
    for /f "tokens=*" %%v in ('npm -v 2^>nul') do set NPM_VER=%%v
    echo [OK] npm encontrado: v%NPM_VER%
)

:: -----------------------------------------------
:: VERIFICAR NGROK (opcional pero avisamos)
:: -----------------------------------------------
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ngrok NO encontrado ^(opcional, necesario para recibir mensajes externos^)
) else (
    echo [OK] ngrok encontrado
)

echo.

:: -----------------------------------------------
:: SI HAY ERRORES MOSTRAR GUIA Y SALIR
:: -----------------------------------------------
if %ERRORES%==1 (
    echo =========================================
    echo   FALTAN HERRAMIENTAS REQUERIDAS
    echo =========================================
    echo.
    echo  Para que la app funcione necesitas instalar:
    echo.
    echo  1. NODE.JS ^(requerido^)
    echo     - Descarga: https://nodejs.org
    echo     - Elige la version LTS ^(18.x o superior^)
    echo     - Instala con las opciones por defecto
    echo     - Reinicia esta ventana despues de instalar
    echo.
    echo  2. NGROK ^(requerido para recibir mensajes de WhatsApp^)
    echo     - Descarga: https://ngrok.com/download
    echo     - Extrae el ejecutable ngrok.exe
    echo     - Muevelo a C:\Windows\System32\ para que funcione global
    echo     - Crea cuenta en https://ngrok.com y copia tu Authtoken
    echo     - Ejecuta: ngrok config add-authtoken TU_TOKEN
    echo.
    echo  Despues de instalar todo, vuelve a abrir este archivo.
    echo.
    pause
    exit /b 1
)

:: -----------------------------------------------
:: VERIFICAR ARCHIVO .env
:: -----------------------------------------------
if not exist ".env" (
    echo [!] Archivo .env no encontrado.
    if exist ".env.example" (
        echo     Creando .env desde plantilla...
        copy ".env.example" ".env" >nul
        echo.
        echo  Abre el archivo .env con el Bloc de notas y completa
        echo  tus credenciales de Meta antes de continuar.
        echo.
        echo  Campos requeridos:
        echo    M4D_APP_ID
        echo    M4D_APP_SECRET
        echo    WA_PHONE_NUMBER_ID
        echo    WA_BUSINESS_ACCOUNT_ID
        echo    CLOUD_API_ACCESS_TOKEN
        echo    WEBHOOK_VERIFICATION_TOKEN
        echo.
        start notepad ".env"
        pause
        exit /b 1
    ) else (
        echo  ERROR: No existe .env.example. Reinstala el proyecto.
        pause
        exit /b 1
    )
)

:: -----------------------------------------------
:: INSTALAR DEPENDENCIAS SI HACE FALTA
:: -----------------------------------------------
if not exist "node_modules" (
    echo Instalando dependencias ^(solo la primera vez^)...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR al instalar dependencias. Revisa tu conexion a internet.
        pause
        exit /b 1
    )
    echo.
)

:: -----------------------------------------------
:: DETENER SERVICIOS PREVIOS
:: -----------------------------------------------
echo Deteniendo servicios anteriores...
taskkill /f /fi "WINDOWTITLE eq Middleware*"    >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Webhook*"       >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq API*"           >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq WebServer*"     >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Ngrok*"         >nul 2>&1

:: Matar procesos node en puertos del proyecto
for %%p in (3000 3002 3004 5678) do (
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%%p "') do (
        taskkill /f /pid %%a >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul

:: Crear carpetas
if not exist "logs" mkdir logs
if not exist "data" mkdir data

:: -----------------------------------------------
:: INICIAR SERVICIOS EN VENTANAS SEPARADAS
:: -----------------------------------------------
echo.
echo Iniciando servicios...
echo.

echo   Middleware        (puerto 3000)...
start "Middleware" /min cmd /c "node src/servers/middleware.js > logs\middleware.log 2>&1"
timeout /t 2 /nobreak >nul

echo   Webhook Simple    (puerto 5678)...
start "Webhook" /min cmd /c "node src/servers/webhook-simple.js > logs\webhook.log 2>&1"
timeout /t 2 /nobreak >nul

echo   API Avanzada      (puerto 3004)...
start "API" /min cmd /c "node src/servers/api-advanced.js > logs\api.log 2>&1"
timeout /t 2 /nobreak >nul

echo   Servidor Web      (puerto 3002)...
start "WebServer" /min cmd /c "node src/servers/web-server.js > logs\web-server.log 2>&1"
timeout /t 2 /nobreak >nul

:: -----------------------------------------------
:: INICIAR NGROK SI ESTA DISPONIBLE
:: -----------------------------------------------
where ngrok >nul 2>&1
if %errorlevel% equ 0 (
    echo   Ngrok             (tunel publico)...
    start "Ngrok" /min cmd /c "ngrok http 3000 > logs\ngrok.log 2>&1"
    timeout /t 4 /nobreak >nul
)

:: -----------------------------------------------
:: RESUMEN Y ABRIR NAVEGADOR
:: -----------------------------------------------
echo.
echo =========================================
echo    SISTEMA LISTO
echo =========================================
echo.
echo   Dashboard:   http://localhost:3002/index.html
echo   API:         http://localhost:3004/api/status
echo   Middleware:  http://localhost:3000/health
echo.
echo Abriendo dashboard en el navegador...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3002/index.html"

echo.
echo Para detener la app ejecuta stop-all o cierra
echo las ventanas minimizadas en la barra de tareas.
echo.
pause
