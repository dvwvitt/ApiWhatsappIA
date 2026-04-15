# ApiWhatsappIA - Guía de Configuración

## 🚀 Comenzar

### 1. Primera vez

```bash
cd ~/Documents/ApiWhatsappIA
npm install                  # Instalar dependencias
npm start                    # Iniciar todos los servicios
```

### 2. Acceder al Dashboard

- **URL**: http://localhost:3002/index.html
- **Credenciales**: No se requieren (sin autenticación)

### 3. Configurar el Sistema

**Opción A: Desde el Dashboard (recomendado)**
1. Abre el dashboard
2. Ve a la pestaña **Configuración**
3. Edita los campos (Meta App ID, tokens, etc.)
4. Haz clic en **Guardar Configuración**
5. Reinicia los servicios desde la pestaña **Sistema**

**Opción B: Editar archivo .env directamente**
```bash
nano .env
# Edita los valores
# Luego reinicia: npm start
```

### 4. Configuración Mínima Requerida

Completa estos campos en `.env`:
- `M4D_APP_ID` — De Meta Developer Console
- `M4D_APP_SECRET` — Igual fuente
- `WA_PHONE_NUMBER_ID` — ID de tu número de WhatsApp Business
- `WA_BUSINESS_ACCOUNT_ID` — ID de tu cuenta comercial
- `CLOUD_API_ACCESS_TOKEN` — Token permanente de acceso
- `WEBHOOK_VERIFICATION_TOKEN` — Token seguro cualquiera
- `NGROK_AUTH_TOKEN` (opcional) — Si usas auth en ngrok

### 5. Monitorear Servicios

**Dashboard → Pestaña "Sistema"**
- Ver estado de cada servicio (verde=activo, rojo=inactivo)
- Iniciar/Detener/Reiniciar servicios individuales
- Ver logs en tiempo real
- Auto-actualiza cada 5 segundos

**Línea de comandos**
```bash
./scripts/check-status.sh      # Ver estado
./scripts/stop-all.sh          # Detener todo
./scripts/start-all.sh         # Iniciar todo
```

## 🔧 Gestión de Datos

- **Mensajes**: `data/messages.json` (auto-ignorado, no en git)
- **Sesiones de Asesores**: `data/sessions.json` (auto-ignorado, no en git)
- **Respuestas (Intenciones)**: `data/responses.json` (guardado en git, es configuración)
- **Asesores**: `data/advisors.json` (guardado en git, es configuración)

## 🔐 Seguridad Git

El proyecto es seguro para subir a repositorio público:

✅ **Ignorados automáticamente:**
- `.env` (credenciales sensibles)
- `data/messages.json` (datos de clientes)
- `data/sessions.json` (datos de conversaciones)
- `logs/` (logs temporales)

✅ **Incluidos en git:**
- `data/responses.json` (intenciones entrenadas)
- `data/advisors.json` (configuración de asesores)
- `package.json`, código fuente (código de aplicación)
- `.env.example` (plantilla)

## 📋 Puertos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Middleware | 3000 | Recibe webhooks de WhatsApp |
| Web Server | 3002 | Dashboard (UI) |
| API Advanced | 3004 | API de control y datos |
| Webhook Simple | 5678 | Procesa conversaciones |
| Ngrok | 4040 | Túnel público (auto-configurado) |

## 🐛 Troubleshooting

### Los servicios no inician
```bash
lsof -i :3000,3002,3004,5678    # Ver qué ocupa los puertos
pkill -f "node src/servers"     # Forzar salida de procesos viejos
npm start                       # Reintentar
```

### Dashboard en blanco
- Abre DevTools (F12)
- Revisa la consola de errores
- Verifica que el API esté activo: http://localhost:3004/api/stats

### Webhook no recibe mensajes
- Verifica el token de verificación coincide
- Chequea la URL pública: dashboard.ngrok.com
- Revisa logs: `tail -f logs/middleware.log`

## 📚 Documentación Adicional

- `docs/QUICK-START.md` — Inicio rápido
- `docs/TRAINING-GUIDE.md` — Entrenar la IA
- `CONFIG.md` — Opciones avanzadas

---

**Última actualización**: 2026-04-15  
**Versión**: 1.0.0
