# Guia rapida

## Como usar el sistema

### 1. Iniciar los servicios

Abre la terminal y ejecuta:

```bash
./scripts/start-all.sh
```

Veras que se inician 4 servicios. Espera a que diga "Sistema listo para usar".

### 2. Abrir el panel

Abre en tu navegador:

```
http://localhost:3002/index.html
```

### 3. Probar con WhatsApp

Envia un mensaje al numero **+573123080083** desde cualquier WhatsApp.

Mensajes de prueba:
- "Hola" - Respuesta de saludo
- "Necesito cambiar la bateria" - Respuesta sobre baterias
- "Cuanto cuesta?" - Consulta de precios
- "Como va mi reloj?" - Consulta de estado

### 4. Ver los resultados

En el panel veras:
- El mensaje que enviaste
- La intencion detectada automaticamente
- La respuesta que se envio

### 5. Detener los servicios

```bash
./scripts/stop-all.sh
```

## Que muestra el panel

- **Mensajes recibidos**: Todos los mensajes de WhatsApp con su intencion
- **Respuestas configuradas**: Las respuestas automaticas activas
- **Estadisticas**: Total de mensajes, tasa de respuesta, intenciones

## Problemas comunes

**El panel esta vacio:**
- Verifica que los servicios esten corriendo: `./scripts/check-status.sh`

**No llegan mensajes:**
- Verifica que ngrok este activo y configurado en Meta Developers
- Revisa los logs: `tail -f logs/middleware.log`
