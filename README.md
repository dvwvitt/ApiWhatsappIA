# WhatsApp Business Middleware

Middleware que conecta la WhatsApp Business API con OpenClaw Gateway. Recibe mensajes de WhatsApp, detecta intenciones automaticamente y responde con mensajes configurables.

## Arquitectura

```
Cliente WhatsApp
      |
      v
Meta Webhook --> Middleware (3000) --> Webhook Simple (5678)
                      |                     |
                      v                     v
                WhatsApp API          Deteccion de intents
                (respuesta)           (analisis automatico)
                      |
                      v
               API Avanzada (3004) <-- Web Server (3002)
               (CRUD datos)            (paneles UI)
```

## Servicios

| Servicio | Puerto | Archivo | Funcion |
|----------|--------|---------|---------|
| Middleware | 3000 | `src/servers/middleware.js` | Recibe webhooks de WhatsApp, envia mensajes |
| Webhook Simple | 5678 | `src/servers/webhook-simple.js` | Analiza mensajes, detecta intenciones, responde |
| Web Server | 3002 | `src/servers/web-server.js` | Sirve los paneles de control |
| API Avanzada | 3004 | `src/servers/api-advanced.js` | CRUD de mensajes y respuestas, entrenamiento |

## Inicio rapido

### 1. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales de Meta/WhatsApp
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Iniciar todos los servicios

```bash
./scripts/start-all.sh
```

### 4. Abrir el panel

```
http://localhost:3002/index.html
```

## Comandos

```bash
./scripts/start-all.sh       # Iniciar todos los servicios
./scripts/stop-all.sh        # Detener todos los servicios
./scripts/check-status.sh    # Verificar estado del sistema

npm run dev                   # Iniciar middleware con nodemon (desarrollo)
npm run test:whatsapp         # Probar conexion con WhatsApp API
npm run test:send             # Enviar mensaje de prueba
```

## Paneles de control

- **Dashboard completo**: `http://localhost:3002/index.html` - Mensajes, respuestas, estadisticas
- **Panel simple**: `http://localhost:3002/simple-index.html` - Vista ligera

## Estructura del proyecto

```
whatsapp-business-middleware/
├── src/servers/           # Servidores Node.js (codigo principal)
│   ├── middleware.js      # Webhook WhatsApp + envio de mensajes
│   ├── webhook-simple.js  # Procesamiento de mensajes + intents
│   ├── api-advanced.js    # API REST para datos
│   └── web-server.js      # Servidor de paneles estaticos
├── public/                # Frontend (HTML/JS)
│   ├── index.html         # Dashboard principal
│   ├── simple-index.html  # Panel ligero
│   └── app.js             # Controlador frontend
├── scripts/               # Scripts de gestion
│   ├── start-all.sh       # Arranque completo
│   ├── stop-all.sh        # Parada limpia
│   └── check-status.sh    # Verificacion de estado
├── data/                  # Datos JSON
│   ├── messages.json      # Mensajes recibidos
│   └── responses.json     # Respuestas configuradas
├── messages/              # Logs JSONL (fallback)
├── logs/                  # Logs del sistema
├── docs/                  # Documentacion adicional
├── .env                   # Configuracion (no se sube a git)
└── package.json
```

## Flujo de mensajes

1. Un cliente envia un mensaje a WhatsApp Business (+573123080083)
2. Meta envia el webhook al Middleware (puerto 3000)
3. El Middleware reenvia al Webhook Simple (puerto 5678) para analisis
4. El Webhook Simple detecta la intencion (saludo, bateria, precio, etc.)
5. Se envia una respuesta automatica al cliente via WhatsApp API
6. El mensaje se guarda en `data/messages.json`
7. Los paneles web muestran los datos en tiempo real

## Intenciones soportadas

| Intencion | Palabras clave | Ejemplo |
|-----------|----------------|---------|
| `saludo` | hola, buenos dias | "Hola, buenos dias" |
| `bateria` | bateria, pila | "Necesito cambiar la bateria" |
| `consulta_estado` | estado, como va | "Como va mi reloj?" |
| `consulta_precio` | precio, cuanto, valor | "Cuanto cuesta?" |
| `no_identificado` | (cualquier otro) | Transferencia a humano |

## Configuracion de Meta Developers

Para que los webhooks funcionen, necesitas:

1. Configurar la Webhook URL en Meta Developers (usa ngrok para desarrollo)
2. Usar el Verify Token definido en `.env`
3. Suscribirse a los campos: `messages`, `message_template_status_update`

## Documentacion adicional

- [Guia rapida](docs/QUICK-START.md) - Para usuarios no tecnicos
- [Guia de entrenamiento](docs/TRAINING-GUIDE.md) - Como configurar respuestas
- [Configuracion VS Code](docs/VSCODE-SETUP.md) - Tareas y debugging

## Solucion de problemas

**No llegan mensajes:**
- Verificar que ngrok este corriendo y la URL configurada en Meta
- `curl http://localhost:3000/health`

**El panel no muestra datos:**
- Verificar que la API este activa: `curl http://localhost:3004/api/status`
- Verificar que `data/messages.json` exista

**No se envian respuestas:**
- Verificar `CLOUD_API_ACCESS_TOKEN` en `.env`
- Revisar logs: `tail -f logs/middleware.log`
