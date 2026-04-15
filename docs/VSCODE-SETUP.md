# Configuracion VS Code

El proyecto incluye configuracion completa para VS Code.

## Tareas disponibles (Ctrl+Shift+P > Tasks: Run Task)

| Tarea | Descripcion |
|-------|-------------|
| Iniciar todos los servicios | Ejecuta `scripts/start-all.sh` |
| Detener todos los servicios | Ejecuta `scripts/stop-all.sh` |
| Verificar estado | Ejecuta `scripts/check-status.sh` |
| Abrir panel | Abre `http://localhost:3002/index.html` en el navegador |
| Ver logs | Muestra logs del middleware en tiempo real |

## Configuraciones de debugging

El archivo `.vscode/launch.json` incluye configuraciones para depurar cada servicio individualmente:

- **Middleware** - Depurar el servidor principal (puerto 3000)
- **Webhook Simple** - Depurar el procesador de mensajes (puerto 5678)
- **API Avanzada** - Depurar la API REST (puerto 3004)
- **Todos los servidores** - Lanzar todos con debugging

Para depurar: F5 o Run > Start Debugging > Seleccionar configuracion.

## Extensiones recomendadas

Las extensiones recomendadas estan en `.vscode/extensions.json`. VS Code te sugerira instalarlas automaticamente al abrir el proyecto.
