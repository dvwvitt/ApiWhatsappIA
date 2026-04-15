# Configuracion

## Variables de entorno (.env)

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `M4D_APP_ID` | Si | ID de la app en Meta Developers |
| `M4D_APP_SECRET` | Si | Secret de la app |
| `WA_PHONE_NUMBER_ID` | Si | ID del numero de telefono en WhatsApp Business |
| `WA_BUSINESS_ACCOUNT_ID` | Si | ID de la cuenta de WhatsApp Business |
| `CLOUD_API_ACCESS_TOKEN` | Si | Token de acceso a la Cloud API de Meta |
| `CLOUD_API_VERSION` | No | Version de la API (default: v19.0) |
| `WHATSAPP_BUSINESS_NUMBER` | No | Numero de WhatsApp Business para referencia |
| `WEBHOOK_ENDPOINT` | No | Ruta del webhook (default: /webhook/whatsapp) |
| `WEBHOOK_VERIFICATION_TOKEN` | Si | Token para verificar el webhook con Meta |
| `PORT` | No | Puerto del middleware (default: 3000) |
| `OPENCLAW_GATEWAY_URL` | No | URL del gateway de OpenClaw |
| `OPENCLAW_API_TOKEN` | No | Token de autenticacion para OpenClaw |
| `LOG_LEVEL` | No | Nivel de log: error, warn, info, debug (default: info) |
| `LOG_FILE` | No | Ruta del archivo de log |

## Puertos

| Puerto | Servicio | Configurable |
|--------|----------|-------------|
| 3000 | Middleware (webhook + envio) | Si, via `PORT` en .env |
| 3002 | Web Server (paneles) | No (hardcoded en web-server.js) |
| 3004 | API Avanzada (CRUD) | No (hardcoded en api-advanced.js) |
| 5678 | Webhook Simple (analisis) | No (hardcoded en webhook-simple.js) |

## Estructura de datos

### messages.json

```json
{
  "id": 1776053480398,
  "message_id": "wamid.HBgM...",
  "from_number": "573123031988",
  "text": "Necesito un cambio de bateria",
  "timestamp": "2026-04-13T04:11:20.398Z",
  "intent": "bateria",
  "response_sent": "Hola, te ayudo con el cambio de bateria...",
  "status": "received"
}
```

### responses.json

```json
{
  "id": 1,
  "name": "Saludo Inicial",
  "intent": "saludo",
  "trigger_words": "hola,buenos dias,buenas tardes",
  "response_text": "Hola! Soy el asistente de Relojeria Milla de Oro.",
  "is_active": true,
  "priority": 1,
  "use_count": 5,
  "success_rate": 100
}
```

## Endpoints API

### Middleware (3000)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/webhook/whatsapp` | Verificacion de webhook (Meta) |
| POST | `/webhook/whatsapp` | Recepcion de mensajes |
| POST | `/send-message` | Enviar mensaje via WhatsApp |
| GET | `/health` | Health check |

### API Avanzada (3004)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/messages` | Listar mensajes |
| GET | `/api/responses` | Listar respuestas |
| POST | `/api/save-responses` | Guardar respuestas |
| POST | `/api/analyze-message` | Analizar un mensaje |
| POST | `/api/train-ai` | Simulacion de entrenamiento |
| GET | `/api/status` | Estado del sistema |

### Webhook Simple (5678)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/webhook/whatsapp-incoming` | Procesar mensaje entrante |
| GET | `/history` | Historial de mensajes (ultimos 20) |
| GET | `/analysis` | Analisis de intenciones |
