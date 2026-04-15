#!/usr/bin/env node

/**
 * Servidor Web Simple para Paneles de Control
 * Puerto: 3002
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = 3002;
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// Crear directorio public si no existe
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Página de inicio
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp Business API - Panel Unificado</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          text-align: center;
          padding: 20px;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          max-width: 800px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
          font-size: 48px;
          margin-bottom: 10px;
          background: linear-gradient(135deg, #fff, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 18px;
          opacity: 0.9;
          margin-bottom: 40px;
        }
        .panels {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 30px;
        }
        .panel-card {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 15px;
          padding: 25px;
          text-decoration: none;
          color: white;
          transition: all 0.3s;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .panel-card:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        .panel-card h3 {
          margin-top: 0;
          font-size: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .panel-card p {
          opacity: 0.8;
          font-size: 14px;
          margin-bottom: 0;
        }
        .icon {
          font-size: 24px;
        }
        .primary {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          grid-column: 1 / -1;
        }
        .status {
          margin-top: 30px;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          font-family: monospace;
        }
        .urls {
          margin-top: 20px;
          text-align: left;
          background: rgba(0, 0, 0, 0.2);
          padding: 15px;
          border-radius: 10px;
          font-size: 14px;
        }
        .urls code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 WhatsApp Business API</h1>
        <div class="subtitle">Sistema Unificado de Automatización</div>
        
        <div class="panels">
          <a href="/index.html" class="panel-card primary">
            <h3>Dashboard Completo</h3>
            <p>Panel principal con todas las funciones: mensajes, respuestas, estadisticas y pruebas.</p>
          </a>

          <a href="/simple-index.html" class="panel-card">
            <h3>Panel Simple</h3>
            <p>Interfaz ligera para operaciones basicas y monitoreo rapido.</p>
          </a>
        </div>
        
        <div class="urls">
          <strong>📱 WhatsApp Business:</strong><br>
          <code>+573123080083</code><br><br>
          
          <strong>🔧 Herramientas técnicas:</strong><br>
          • <code>http://localhost:3000/health</code> - Health check middleware<br>
          • <code>http://localhost:3004</code> - API avanzada<br>
          • <code>http://localhost:5678</code> - Webhook simple<br>
          • <code>http://localhost:4040</code> - Dashboard Ngrok
        </div>
        
        <div class="status">
          ✅ Servidor web activo en puerto ${PORT}<br>
          🕐 ${new Date().toLocaleTimeString()}
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'web-server',
    port: PORT,
    timestamp: new Date().toISOString(),
    endpoints: [
      '/index.html',
      '/simple-index.html',
      '/health'
    ]
  });
});

// Proxy: reenviar todas las peticiones /api/* al API server (puerto 3004)
const API_URL = 'http://localhost:3004';

app.use('/api', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${API_URL}${req.originalUrl}`,
      data: req.method !== 'GET' ? req.body : undefined,
      headers: { 'Content-Type': 'application/json' },
      timeout: req.originalUrl.startsWith('/api/ai/chat') ? 60000 : 15000,
      responseType: 'arraybuffer'
    });

    // Pasar content-type y headers de descarga del API original
    const contentType = response.headers['content-type'] || 'application/json';
    const contentDisp = response.headers['content-disposition'];
    res.set('Content-Type', contentType);
    if (contentDisp) res.set('Content-Disposition', contentDisp);
    res.status(response.status).send(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(502).json({ error: 'API no disponible. Verifica que el servicio API (puerto 3004) este corriendo.' });
    }
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor web iniciado en http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/index.html`);
  console.log(`Panel simple: http://localhost:${PORT}/simple-index.html`);
});

// Manejar cierre limpio
process.on('SIGINT', () => {
  console.log('🛑 Deteniendo servidor web...');
  process.exit(0);
});