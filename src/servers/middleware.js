#!/usr/bin/env node

/**
 * WhatsApp Business API Middleware para OpenClaw
 * Conecta WhatsApp Business API con OpenClaw Gateway
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const winston = require('winston');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuración de logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || 'logs/whatsapp-middleware.log' 
    })
  ]
});

// Configuración de la app
const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_ENDPOINT = process.env.WEBHOOK_ENDPOINT || '/webhook/whatsapp';
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFICATION_TOKEN || 'OpenClawWA_Verify_Default';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Variables de configuración WhatsApp
const WHATSAPP_CONFIG = {
  appId: process.env.M4D_APP_ID,
  appSecret: process.env.M4D_APP_SECRET,
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
  businessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID,
  accessToken: process.env.CLOUD_API_ACCESS_TOKEN,
  apiVersion: process.env.CLOUD_API_VERSION || 'v19.0',
  businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER,
  apiBaseUrl: `https://graph.facebook.com/${process.env.CLOUD_API_VERSION || 'v19.0'}`
};

// Configuración OpenClaw
const OPENCLAW_CONFIG = {
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789',
  apiToken: process.env.OPENCLAW_API_TOKEN
};

// Verificar configuración
function validateConfig() {
  const required = ['M4D_APP_ID', 'M4D_APP_SECRET', 'CLOUD_API_ACCESS_TOKEN', 'WA_PHONE_NUMBER_ID', 'WA_BUSINESS_ACCOUNT_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`Configuración faltante: ${missing.join(', ')}`);
    return false;
  }
  
  logger.info('Configuración WhatsApp Business API validada');
  logger.info(`App ID: ${WHATSAPP_CONFIG.appId}`);
  logger.info(`Phone Number ID: ${WHATSAPP_CONFIG.phoneNumberId}`);
  logger.info(`Business Account ID: ${WHATSAPP_CONFIG.businessAccountId}`);
  logger.info(`API Version: ${WHATSAPP_CONFIG.apiVersion}`);
  
  return true;
}

// Endpoint de verificación de webhook (GET)
app.get(WEBHOOK_ENDPOINT, (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info(`Webhook verification request: mode=${mode}, token=${token}`);

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('Webhook verificado exitosamente');
      res.status(200).send(challenge);
    } else {
      logger.error('Token de verificación inválido');
      res.sendStatus(403);
    }
  } else {
    logger.error('Parámetros de verificación faltantes');
    res.sendStatus(400);
  }
});

// Endpoint principal de webhook (POST)
app.post(WEBHOOK_ENDPOINT, (req, res) => {
  logger.info('Webhook recibido de WhatsApp Business API');
  
  // Verificar si es un ping de prueba
  if (req.body.object) {
    if (req.body.entry) {
      // Procesar entradas
      req.body.entry.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'messages') {
            processWhatsAppMessage(change.value);
          }
        });
      });
    }
    
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Procesar mensaje de WhatsApp
async function processWhatsAppMessage(messageData) {
  try {
    logger.info('Procesando mensaje de WhatsApp', { messageData });
    
    // Extraer información del mensaje
    const message = messageData.messages?.[0];
    if (!message) {
      logger.warn('No hay mensajes en el webhook');
      return;
    }
    
    const from = message.from; // Número del remitente
    const text = message.text?.body || '';
    const messageId = message.id;
    const timestamp = message.timestamp;
    
    logger.info(`Mensaje recibido de ${from}: ${text.substring(0, 50)}...`);
    
    // Enviar a OpenClaw
    await forwardToOpenClaw({
      from,
      text,
      messageId,
      timestamp,
      platform: 'whatsapp_business',
      rawMessage: message
    });
    
  } catch (error) {
    logger.error('Error procesando mensaje de WhatsApp:', error);
  }
}

// Enviar mensaje a OpenClaw
async function forwardToOpenClaw(message) {
  try {
    logger.info(`Enviando mensaje a OpenClaw: ${message.from} -> ${message.text.substring(0, 50)}...`);
    
    // TODO: Implementar lógica de envío a OpenClaw
    // Esto podría ser via WebSocket, HTTP API, o el método que OpenClaw exponga
    
    // Ejemplo con HTTP (ajustar según API de OpenClaw)
    const response = await axios.post(`${OPENCLAW_CONFIG.gatewayUrl}/api/messages`, {
      message: message.text,
      sender: message.from,
      platform: 'whatsapp',
      metadata: {
        whatsapp_message_id: message.messageId,
        timestamp: message.timestamp
      }
    }, {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_CONFIG.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.info('Mensaje enviado a OpenClaw exitosamente');
    return response.data;
    
  } catch (error) {
    logger.error('Error enviando mensaje a OpenClaw:', error.message);
    
    // Intentar método alternativo si el primero falla
    await fallbackToOpenClaw(message);
  }
}

// Método alternativo para enviar a OpenClaw
async function fallbackToOpenClaw(message) {
  try {
    logger.info('Intentando método alternativo para OpenClaw...');
    
    // Opción 1: Enviar a n8n (recomendado para entrenamiento)
    const n8nResult = await sendToN8N(message);
    if (n8nResult) {
      logger.info('Mensaje enviado a n8n exitosamente');
      return true;
    }
    
    // Opción 2: Escribir a archivo JSONL (fallback)
    const messageEntry = {
      timestamp: new Date().toISOString(),
      platform: 'whatsapp_business',
      from: message.from,
      text: message.text,
      messageId: message.messageId,
      raw: message.rawMessage
    };
    
    const filePath = path.join(__dirname, '..', '..', 'messages', 'incoming.jsonl');
    const line = JSON.stringify(messageEntry) + '\n';
    
    await fs.promises.appendFile(filePath, line, 'utf8');
    
    logger.info('Mensaje escrito a archivo para OpenClaw (fallback)', { 
      filePath, 
      from: message.from,
      textLength: message.text.length 
    });
    
    return true;
    
  } catch (error) {
    logger.error('Método alternativo también falló:', error.message);
    return false;
  }
}

// Enviar mensaje al Webhook Simple
async function sendToN8N(message) {
  try {
    const controlPanelUrl = 'http://localhost:5678/webhook/whatsapp-incoming';
    
    // Formato para el Panel de Control
    const payload = {
      messageData: {
        messages: [{
          from: message.from,
          id: message.messageId,
          timestamp: Math.floor(new Date(message.timestamp).getTime() / 1000),
          text: { body: message.text },
          type: 'text'
        }],
        contacts: [{
          profile: { name: 'Cliente' },
          wa_id: message.from
        }],
        messaging_product: 'whatsapp',
        metadata: {
          display_phone_number: WHATSAPP_CONFIG.businessNumber,
          phone_number_id: WHATSAPP_CONFIG.phoneNumberId
        }
      }
    };
    
    const response = await axios.post(controlPanelUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5 segundos timeout
    });
    
    logger.info('Mensaje enviado al Panel de Control', { 
      controlPanelUrl,
      status: response.status,
      from: message.from 
    });
    
    // El panel de control puede devolver una respuesta para enviar
    if (response.data && response.data.response) {
      await sendToWhatsApp(message.from, response.data.response);
    }
    
    return true;
    
  } catch (error) {
    logger.warn('No se pudo enviar al Panel de Control, usando fallback:', error.message);
    return false;
  }
}

// Enviar mensaje a WhatsApp
async function sendToWhatsApp(to, message) {
  try {
    logger.info(`Enviando mensaje a WhatsApp: ${to} -> ${message.substring(0, 50)}...`);
    
    const url = `${WHATSAPP_CONFIG.apiBaseUrl}/${WHATSAPP_CONFIG.phoneNumberId}/messages`;
    
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        body: message
      }
    }, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.info('Mensaje enviado a WhatsApp exitosamente', { messageId: response.data?.messages?.[0]?.id });
    return response.data;
    
  } catch (error) {
    logger.error('Error enviando mensaje a WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

// Endpoint para enviar mensajes (desde OpenClaw)
app.post('/send-message', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Faltan parámetros: to y message son requeridos' });
    }
    
    const result = await sendToWhatsApp(to, message);
    res.json({ success: true, result });
    
  } catch (error) {
    logger.error('Error en endpoint /send-message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-business-middleware',
    timestamp: new Date().toISOString(),
    config: {
      whatsapp: {
        appId: WHATSAPP_CONFIG.appId ? 'configured' : 'missing',
        phoneNumberId: WHATSAPP_CONFIG.phoneNumberId ? 'configured' : 'missing',
        businessAccountId: WHATSAPP_CONFIG.businessAccountId ? 'configured' : 'missing'
      },
      openclaw: {
        gatewayUrl: OPENCLAW_CONFIG.gatewayUrl,
        configured: !!OPENCLAW_CONFIG.gatewayUrl
      },
      webhook: {
        endpoint: WEBHOOK_ENDPOINT,
        verified: false // Esto se actualizaría después de la verificación
      }
    }
  });
});

// Iniciar servidor
if (validateConfig()) {
  app.listen(PORT, () => {
    logger.info(`WhatsApp Business Middleware iniciado en puerto ${PORT}`);
    logger.info(`Webhook endpoint: http://localhost:${PORT}${WEBHOOK_ENDPOINT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info(`OpenClaw Gateway: ${OPENCLAW_CONFIG.gatewayUrl}`);
    
    console.log(`
    ============================================
    WhatsApp Business Middleware para OpenClaw
    ============================================
    URL local:  http://localhost:${PORT}
    Webhook:    http://localhost:${PORT}${WEBHOOK_ENDPOINT}
    Health:     http://localhost:${PORT}/health
    ============================================
    `);
  });
} else {
  logger.error('No se puede iniciar el servidor debido a configuración faltante');
  process.exit(1);
}