# INSTALL.md — Guia de Instalacion Completa

> Documento dirigido a cualquier instalador (humano o IA) que clone este repositorio
> y necesite poner el sistema en funcionamiento desde cero.

---

## Creditos y Licencia

**ApiWhatsappIA** es una creacion original de **Alejandro Hernandez**
([@alejo.hrndz](https://www.instagram.com/alejo.hrndz) en Instagram),
desarrollada con asistencia de **Claude (Anthropic)** desde la concepcion
hasta el lanzamiento de la primera version publica.

Licencia: **MIT con atribucion requerida**

```
Copyright (c) 2026 Alejandro Hernandez

Se concede permiso, de forma gratuita, a cualquier persona que obtenga
una copia de este software y los archivos de documentacion asociados
(el "Software"), para utilizar el Software sin restricciones, incluyendo
sin limitacion los derechos de usar, copiar, modificar, fusionar, publicar,
distribuir, sublicenciar y/o vender copias del Software, y para permitir
a las personas a las que se proporcione el Software que lo hagan, sujeto
a las siguientes condiciones:

1. La creacion y autoria original pertenece a Alejandro Hernandez
   (Instagram: @alejandro.h_), con asistencia de Claude AI (Anthropic).
2. El aviso de copyright anterior y este aviso de permiso se incluiran
   en todas las copias o partes sustanciales del Software.

EL SOFTWARE SE PROPORCIONA "TAL CUAL", SIN GARANTIA DE NINGUN TIPO.
```

---

## Descripcion del sistema

ApiWhatsappIA es un middleware Node.js que conecta la **WhatsApp Business Cloud API**
(Meta) con un motor de respuestas automaticas basado en deteccion de intenciones
(keywords). Incluye:

- Recepcion de webhooks de WhatsApp y envio de respuestas automaticas
- Panel de control web (dashboard) para visualizar mensajes en tiempo real
- API REST interna para gestionar respuestas entrenadas
- Soporte de asesores en vivo con transferencia de conversacion
- Tunel publico via ngrok (para desarrollo local)

---

## Requisitos previos

Antes de clonar el repositorio verifica que tienes instalado:

| Herramienta | Version minima | Como verificar |
|-------------|----------------|----------------|
| Node.js | 18.x o superior | `node -v` |
| npm | 9.x o superior | `npm -v` |
| Git | cualquier reciente | `git --version` |
| ngrok | 3.x | `ngrok version` |
| curl | cualquier | `curl --version` |

### Instalar Node.js (si no lo tienes)

```bash
# macOS con Homebrew
brew install node

# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows: descarga el instalador desde https://nodejs.org
```

### Instalar ngrok (si no lo tienes)

```bash
# macOS con Homebrew
brew install ngrok/ngrok/ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Windows: descarga desde https://ngrok.com/download
```

---

## Cuentas externas necesarias

Necesitas tener activas las siguientes cuentas antes de configurar el proyecto:

### 1. Meta for Developers (obligatorio)

Crea o accede a tu cuenta en https://developers.facebook.com

Datos que necesitaras obtener desde el portal de Meta:

| Dato | Donde encontrarlo en Meta |
|------|--------------------------|
| `M4D_APP_ID` | App Dashboard > Basic Settings > App ID |
| `M4D_APP_SECRET` | App Dashboard > Basic Settings > App Secret |
| `WA_PHONE_NUMBER_ID` | WhatsApp > Getting Started > Phone Number ID |
| `WA_BUSINESS_ACCOUNT_ID` | WhatsApp > Getting Started > Business Account ID |
| `CLOUD_API_ACCESS_TOKEN` | WhatsApp > Getting Started > Temporary/Permanent Token |

> **Nota:** El token temporal expira en 24 horas. Para produccion genera un
> token permanente desde System Users en Business Manager.

### 2. ngrok (obligatorio para desarrollo local)

Registrate en https://ngrok.com y obtiene tu `Authtoken` desde el dashboard.
Lo necesitaras como `NGROK_AUTH_TOKEN` en el archivo `.env`.

---

## Instalacion paso a paso

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/ApiWhatsappIA.git
cd ApiWhatsappIA
```

> Reemplaza `TU_USUARIO` con el usuario de GitHub donde esta alojado el repo.

### Paso 2 — Instalar dependencias

```bash
npm install
```

Esto instala: express, axios, dotenv, winston, cors, body-parser, nodemon.

### Paso 3 — Crear el archivo de entorno

```bash
cp .env.example .env
```

Ahora abre `.env` con tu editor:

```bash
# macOS / Linux
nano .env
# o
code .env

# Windows
notepad .env
```

Completa **todos** los campos marcados como requeridos:

```env
# --- Meta / Facebook App ---
M4D_APP_ID=123456789012345          # Tu App ID de Meta
M4D_APP_SECRET=abcdef1234567890     # Tu App Secret
WA_PHONE_NUMBER_ID=109876543210     # Phone Number ID de WhatsApp
WA_BUSINESS_ACCOUNT_ID=987654321   # Business Account ID
CLOUD_API_ACCESS_TOKEN=EAABwzLixnjYBO...  # Token de acceso Cloud API
CLOUD_API_VERSION=v19.0            # No cambiar salvo que Meta lo requiera
WHATSAPP_BUSINESS_NUMBER=+57XXXXXXXXXX  # Tu numero (referencia interna)

# --- Ngrok ---
NGROK_AUTH_TOKEN=2abc...xyz        # Tu authtoken de ngrok.com

# --- Webhook ---
WEBHOOK_ENDPOINT=/webhook/whatsapp
WEBHOOK_VERIFICATION_TOKEN=mi_token_secreto_seguro_2026  # Inventa uno

# --- Servidor ---
PORT=3000
```

> Los campos `OPENCLAW_GATEWAY_URL` y `OPENCLAW_API_TOKEN` son opcionales
> y solo se usan si integras con una plataforma externa de tipo OpenClaw.

### Paso 4 — Dar permisos de ejecucion a los scripts (Linux/macOS)

```bash
chmod +x scripts/start-all.sh
chmod +x scripts/stop-all.sh
chmod +x scripts/check-status.sh
```

> En Windows este paso no aplica. Ejecuta los servicios manualmente con Node
> o usa Git Bash.

### Paso 5 — Iniciar todos los servicios

```bash
npm start
# equivale a: ./scripts/start-all.sh
```

Esto levanta cuatro procesos en paralelo:

| Servicio | Puerto | Funcion |
|----------|--------|---------|
| Middleware | 3000 | Recibe webhooks de WhatsApp, envia mensajes |
| Web Server | 3002 | Sirve el panel de control (dashboard) |
| API Avanzada | 3004 | CRUD de mensajes y respuestas |
| Webhook Simple | 5678 | Analiza mensajes y detecta intenciones |

Adicionalmente se lanza **ngrok** apuntando al puerto 3000 para exponer el
webhook al internet.

### Paso 6 — Verificar que todo funciona

```bash
# Ver estado de todos los servicios
npm run status
# o
./scripts/check-status.sh

# Health check manual del middleware
curl http://localhost:3000/health

# Estado de la API
curl http://localhost:3004/api/status
```

Abre el dashboard en tu navegador:

```
http://localhost:3002/index.html
```

### Paso 7 — Obtener la URL publica de ngrok

Ngrok crea un tunel publico. Para verlo:

```bash
curl http://localhost:4040/api/tunnels
```

O abre http://localhost:4040 en el navegador. Copia la URL HTTPS, ejemplo:

```
https://abc123def456.ngrok-free.app
```

### Paso 8 — Configurar el webhook en Meta Developers

1. Ve a https://developers.facebook.com > tu App > WhatsApp > Configuration
2. En **Webhook**, haz clic en **Edit**
3. Pega la URL de ngrok con la ruta del webhook:
   ```
   https://abc123def456.ngrok-free.app/webhook/whatsapp
   ```
4. En **Verify Token**, escribe exactamente el mismo valor que pusiste
   en `WEBHOOK_VERIFICATION_TOKEN` en tu `.env`
5. Haz clic en **Verify and Save**
6. En **Webhook fields**, suscribete a: `messages`

> Si la verificacion falla, revisa que el middleware este corriendo en el
> puerto 3000 y que ngrok este activo.

### Paso 9 — Enviar un mensaje de prueba

Desde tu celular envia un mensaje de WhatsApp al numero de tu cuenta Business.
Deberia aparecer en el dashboard en tiempo real.

Para enviar un mensaje de prueba programatico:

```bash
npm run test:send
```

---

## Estructura de archivos importantes

```
ApiWhatsappIA/
├── .env.example        <- Plantilla de configuracion (editar como .env)
├── .env                <- TU configuracion real (NO en git)
├── .gitignore          <- Protege .env y datos sensibles
├── package.json        <- Dependencias y scripts
├── INSTALL.md          <- Este archivo
├── README.md           <- Descripcion tecnica del proyecto
├── SETUP_GUIDE.md      <- Guia rapida de referencia
├── CONFIG.md           <- Referencia de variables y endpoints
│
├── src/servers/
│   ├── middleware.js       <- Servidor principal (webhook + envio)
│   ├── webhook-simple.js   <- Motor de intenciones
│   ├── api-advanced.js     <- API REST interna
│   └── web-server.js       <- Servidor del dashboard
│
├── public/
│   ├── index.html          <- Dashboard principal
│   ├── simple-index.html   <- Vista ligera
│   └── app.js              <- Logica del frontend
│
├── scripts/
│   ├── start-all.sh        <- Arrancar todos los servicios
│   ├── stop-all.sh         <- Detener todo limpiamente
│   └── check-status.sh     <- Ver estado del sistema
│
├── data/
│   ├── responses.json      <- Respuestas configuradas (en git)
│   ├── advisors.json       <- Asesores registrados (en git)
│   └── messages.json       <- Mensajes recibidos (NO en git)
│
└── docs/
    ├── QUICK-START.md
    ├── TRAINING-GUIDE.md
    └── VSCODE-SETUP.md
```

---

## Comandos de referencia rapida

```bash
npm start                # Iniciar todos los servicios
npm stop                 # Detener todos los servicios
npm run status           # Ver estado del sistema

npm run dev              # Modo desarrollo (nodemon, solo middleware)
npm run test:whatsapp    # Probar conexion con WhatsApp API
npm run test:send        # Enviar mensaje de prueba
```

---

## Solucion de problemas frecuentes

### El webhook no se verifica en Meta

- Confirma que el middleware esta corriendo: `curl http://localhost:3000/health`
- Confirma que ngrok esta activo: `curl http://localhost:4040/api/tunnels`
- Verifica que `WEBHOOK_VERIFICATION_TOKEN` en `.env` sea identico al que
  ingresaste en el portal de Meta (sin espacios extra)

### Los puertos estan ocupados al iniciar

```bash
# Ver que proceso usa el puerto (ejemplo puerto 3000)
lsof -i :3000

# Forzar liberacion de todos los servicios del proyecto
./scripts/stop-all.sh

# Si persiste
pkill -f "node src/servers"
npm start
```

### El dashboard no muestra mensajes

1. Abre DevTools en el navegador (F12 > Console)
2. Verifica que la API responde: `curl http://localhost:3004/api/messages`
3. Si no responde, revisa que `api-advanced.js` este corriendo:
   `npm run status`

### Token de acceso expirado (error 401 de Meta)

El token temporal dura 24 horas. Para solucionarlo:
1. Ve a Meta Developers > WhatsApp > Getting Started
2. Genera un nuevo token
3. Actualiza `CLOUD_API_ACCESS_TOKEN` en `.env`
4. Reinicia: `npm start`

Para evitar expiraciones, genera un **token permanente** via System Users
en Meta Business Manager.

### ngrok muestra "ERR_NGROK_108" (limite de sesiones)

El plan gratuito de ngrok permite un tunel a la vez. Cierra otras sesiones
de ngrok y reinicia: `npm start`

---

## Variables de entorno — referencia completa

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `M4D_APP_ID` | Si | ID de la aplicacion en Meta Developers |
| `M4D_APP_SECRET` | Si | Secret de la aplicacion |
| `WA_PHONE_NUMBER_ID` | Si | ID del numero de telefono WhatsApp Business |
| `WA_BUSINESS_ACCOUNT_ID` | Si | ID de la cuenta Business de WhatsApp |
| `CLOUD_API_ACCESS_TOKEN` | Si | Token de acceso a la Cloud API de Meta |
| `CLOUD_API_VERSION` | No | Version de la API (default: v19.0) |
| `WHATSAPP_BUSINESS_NUMBER` | No | Numero de referencia interna (no expuesto) |
| `NGROK_AUTH_TOKEN` | Recomendado | Token de autenticacion de ngrok |
| `WEBHOOK_ENDPOINT` | No | Ruta del webhook (default: /webhook/whatsapp) |
| `WEBHOOK_VERIFICATION_TOKEN` | Si | Token de verificacion del webhook con Meta |
| `PORT` | No | Puerto del middleware (default: 3000) |
| `OPENCLAW_GATEWAY_URL` | No | URL del gateway OpenClaw (opcional) |
| `OPENCLAW_API_TOKEN` | No | Token OpenClaw (opcional) |
| `LOG_LEVEL` | No | Nivel de log: error, warn, info, debug |
| `LOG_FILE` | No | Ruta del archivo de log |

---

## Notas de seguridad

- El archivo `.env` **nunca** se sube a Git (esta en `.gitignore`)
- `data/messages.json` tampoco se sube (datos de clientes)
- El `WEBHOOK_VERIFICATION_TOKEN` puede ser cualquier cadena segura
  (minimo 16 caracteres aleatorios recomendado)
- No compartas tu `CLOUD_API_ACCESS_TOKEN` en ningun lugar publico

---

## Primera version — v1.0.0

Lanzamiento inicial del proyecto **ApiWhatsappIA**.

Creado por: **Alejandro Hernandez** ([@alejo.hrndz](https://www.instagram.com/alejo.hrndz))
Con asistencia de: **Claude AI** (Anthropic)
Fecha: Abril 2026
