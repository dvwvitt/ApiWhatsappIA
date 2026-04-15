#!/usr/bin/env node

/**
 * Servidor webhook simple para WhatsApp Business
 * Simula funcionalidad básica de n8n para pruebas
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AIClient = require('../lib/ai-client');
const aiClient = new AIClient();

const app = express();
const PORT = 5678;

// Persistencia a disco
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CONV_STATES_FILE = path.join(DATA_DIR, 'conversation-states.json');
const ADVISORS_FILE = path.join(DATA_DIR, 'advisors.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const STATE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutos
const SESSION_INACTIVITY_MS = 120 * 1000; // 120 segundos

// ===== Estado de conversación por número =====
function loadConversationStates() {
  try {
    if (fs.existsSync(CONV_STATES_FILE)) {
      return JSON.parse(fs.readFileSync(CONV_STATES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo conversation-states.json:', e.message);
  }
  return {};
}

function saveConversationStates(states) {
  const tmpFile = CONV_STATES_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(states, null, 2), 'utf8');
  fs.renameSync(tmpFile, CONV_STATES_FILE);
}

function getConversationState(from) {
  const states = loadConversationStates();
  const state = states[from];
  if (!state) return null;
  // Expirar si > 30 min sin actividad
  if (Date.now() - new Date(state.last_activity).getTime() > STATE_EXPIRY_MS) {
    delete states[from];
    saveConversationStates(states);
    return null;
  }
  return state;
}

function setConversationState(from, state) {
  const states = loadConversationStates();
  states[from] = { ...state, last_activity: new Date().toISOString() };
  saveConversationStates(states);
}

function clearConversationState(from) {
  const states = loadConversationStates();
  delete states[from];
  saveConversationStates(states);
}

// ===== Asesores y sesiones =====
function loadAdvisors() {
  try {
    if (fs.existsSync(ADVISORS_FILE)) {
      return JSON.parse(fs.readFileSync(ADVISORS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo advisors.json:', e.message);
  }
  return [];
}

function saveAdvisors(advisors) {
  const tmpFile = ADVISORS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(advisors, null, 2), 'utf8');
  fs.renameSync(tmpFile, ADVISORS_FILE);
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo sessions.json:', e.message);
  }
  return [];
}

function saveSessions(sessions) {
  const tmpFile = SESSIONS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(sessions, null, 2), 'utf8');
  fs.renameSync(tmpFile, SESSIONS_FILE);
}

function isAdvisor(phone) {
  return loadAdvisors().some(a => a.phone === phone && a.is_active);
}

function getActiveSession(phone) {
  const sessions = loadSessions();
  return sessions.find(s =>
    s.status === 'active' && (s.advisor_phone === phone || s.client_phone === phone)
  );
}

function getAdvisorForClient(clientPhone) {
  const sessions = loadSessions();
  const session = sessions.find(s => s.client_phone === clientPhone && s.status === 'active');
  if (session) {
    return loadAdvisors().find(a => a.phone === session.advisor_phone);
  }
  return null;
}

function persistMessage(record) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let messages = [];
    try {
      if (fs.existsSync(MESSAGES_FILE)) {
        messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Error leyendo messages.json, iniciando array vacio:', e.message);
      messages = [];
    }

    // Evitar duplicados por message_id
    if (record.message_id && messages.some(m => m.message_id === record.message_id)) {
      return;
    }

    messages.push(record);

    // Escritura atomica: tmp + rename
    const tmpFile = MESSAGES_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(messages, null, 2), 'utf8');
    fs.renameSync(tmpFile, MESSAGES_FILE);

    console.log(`💾 Mensaje persistido (total: ${messages.length})`);
  } catch (error) {
    console.error('Error persistiendo mensaje:', error.message);
  }
}

app.use(bodyParser.json());

// Almacenar mensajes para análisis (limitado a 1000 entradas)
const MAX_HISTORY = 1000;
const messageHistory = [];
const responseLog = [];

// Endpoint principal de webhook
app.post('/webhook/whatsapp-incoming', async (req, res) => {
  console.log('📨 Webhook recibido de WhatsApp Business');
  console.log('========================================');
  
  // Formato 1: Datos directos del middleware (nuevo formato)
  let messageData = req.body.messageData || {};
  
  // Formato 2: Si viene en el formato raw del middleware
  if (req.body.raw && req.body.raw.text) {
    console.log('📝 Detectado formato raw del middleware');
    messageData = {
      messages: [{
        from: req.body.from,
        id: req.body.messageId,
        timestamp: Math.floor(new Date(req.body.timestamp).getTime() / 1000),
        text: { body: req.body.text },
        type: 'text'
      }],
      contacts: [{
        profile: { name: 'Cliente' },
        wa_id: req.body.from
      }]
    };
  }
  
  const messages = messageData.messages || [];
  const contacts = messageData.contacts || [];
  
  if (messages.length === 0) {
    console.log('⚠️  No hay mensajes en el webhook');
    console.log('📦 Body recibido:', JSON.stringify(req.body, null, 2).substring(0, 200) + '...');
    return res.status(400).json({ error: 'No messages' });
  }
  
  const message = messages[0];
  const contact = contacts[0] || {};
  
  // Extraer datos
  const from = message.from || 'desconocido';
  const text = message.text?.body || '';
  const messageId = message.id || '';
  const timestamp = message.timestamp || '';
  const profileName = contact.profile?.name || 'Cliente';
  
  console.log(`👤 De: ${from} (${profileName})`);
  console.log(`📝 Mensaje: "${text}"`);
  console.log(`🆔 ID: ${messageId}`);
  console.log(`🕐 Timestamp: ${new Date(timestamp * 1000).toISOString()}`);
  
  // Guardar en historial
  const messageRecord = {
    id: messageId,
    from,
    text,
    profileName,
    timestamp: new Date(timestamp * 1000).toISOString(),
    receivedAt: new Date().toISOString(),
    raw: message
  };
  
  messageHistory.push(messageRecord);
  if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
  
  // Analizar intención (con from para flujos multi-paso)
  const analysis = await analyzeMessage(text, profileName, from);
  console.log(`🎯 Intención detectada: ${analysis.intent}`);
  console.log(`💡 Acción sugerida: ${analysis.action}`);
  console.log(`💬 Respuesta sugerida: "${analysis.response}"`);

  // Persistir mensaje a data/messages.json
  persistMessage({
    id: Date.now(),
    message_id: messageId,
    from_number: from,
    text: text,
    timestamp: new Date(timestamp * 1000).toISOString(),
    intent: analysis.intent,
    response_sent: analysis.sendAutoReply ? analysis.response : null,
    status: 'received'
  });

  // Enviar respuesta automática (opcional)
  if (analysis.sendAutoReply) {
    sendAutoReply(from, analysis.response)
      .then(result => {
        console.log(`✅ Respuesta enviada: ${result.success ? 'Éxito' : 'Error'}`);
        responseLog.push({
          messageId,
          response: analysis.response,
          sentAt: new Date().toISOString(),
          success: result.success
        });
        if (responseLog.length > MAX_HISTORY) responseLog.shift();
      })
      .catch(error => {
        console.error(`❌ Error enviando respuesta: ${error.message}`);
      });
  }
  
  res.json({
    success: true,
    message: 'Webhook recibido',
    analysis,
    messageId
  });
});

// Endpoint para ver historial
app.get('/history', (req, res) => {
  res.json({
    totalMessages: messageHistory.length,
    messages: messageHistory.slice(-20), // Últimos 20 mensajes
    totalResponses: responseLog.length,
    responses: responseLog.slice(-20)
  });
});

// Endpoint para análisis
app.get('/analysis', (req, res) => {
  const intents = {};
  messageHistory.forEach(msg => {
    const analysis = analyzeMessage(msg.text, msg.profileName);
    intents[analysis.intent] = (intents[analysis.intent] || 0) + 1;
  });
  
  res.json({
    totalMessages: messageHistory.length,
    intents,
    commonWords: getCommonWords(),
    responseRate: responseLog.length / messageHistory.length
  });
});

// Cargar respuestas desde data/responses.json
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');

function loadResponses() {
  try {
    if (fs.existsSync(RESPONSES_FILE)) {
      return JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo responses.json:', e.message);
  }
  return [];
}

// Normalizar texto: quitar acentos para matching flexible
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Función para analizar mensaje — máquina de estados para asesores
async function analyzeMessage(text, profileName, from) {
  // 1. Si es asesor — manejar comandos y relay
  if (isAdvisor(from)) {
    const advisorResult = handleAdvisorMessage(text, from);
    if (advisorResult) return advisorResult;
  }

  // 2. Si tiene sesión activa de cliente — relay al asesor
  const session = getActiveSession(from);
  if (session && session.client_phone === from) {
    return handleClientInSession(text, profileName, from);
  }

  // 3. Si está en recolección de datos — continuar con el flujo
  const state = getConversationState(from);
  if (state && state.type === 'data_collection') {
    return await handleDataCollection(text, profileName, from);
  }

  // 4. Si hay flujo multi-paso activo — procesar follow-up
  const flowResult = handleFollowUpFlow(text, profileName, from);
  if (flowResult) return flowResult;

  // 5. Siempre intentar reglas primero — si matchea una respuesta con follow-ups, usarla
  const rulesResult = analyzeMessageRules(text, profileName, from);
  if (rulesResult.source === 'flow' || rulesResult.matched_id) {
    const responses = loadResponses();
    const matchedResp = responses.find(r => r.id === rulesResult.matched_id);
    if (matchedResp && matchedResp.follow_ups && matchedResp.follow_ups.length > 0) {
      return rulesResult;
    }
  }

  // 6. Si no hay flujo, intentar IA con contexto de intenciones
  try {
    const aiConfig = aiClient.loadConfig();
    if (aiConfig.installed && aiConfig.enabled && aiConfig.activeBrain) {
      const responses = loadResponses();

      // Construir contexto enriquecido: incluir ai_context de cada intención
      const respContext = responses.filter(r => r.is_active).map(r => {
        let line = `- "${r.intent}": triggers=[${r.trigger_words}] → "${r.response_text?.substring(0, 100)}"`;
        if (r.ai_context) {
          line += `\n  CONTEXTO: ${r.ai_context}`;
        }
        return line;
      }).join('\n');

      const enrichedPrompt = (aiConfig.systemPrompt || '') +
        `\n\nIntenciones y contexto del negocio (usa esta información para responder directamente sin inventar):\n${respContext || '(ninguna)'}` +
        `\n\nEl cliente se llama: ${profileName}. Responde de forma breve y directa usando SOLO la información del contexto. No inventes datos.`;

      const aiReply = await aiClient.chat(
        [{ role: 'user', content: text }],
        { systemPrompt: enrichedPrompt, timeout: 10000 }
      );
      if (aiReply && aiReply.trim()) {
        return {
          intent: 'ai_response', action: 'auto_response',
          response: aiReply.trim(), sendAutoReply: true,
          confidence: 0.95, source: 'ai'
        };
      }
    }
  } catch (e) {
    console.error('⚠️  AI falló, usando reglas:', e.message);
  }

  // 7. Retornar resultado de reglas — si es no_identificado, iniciar recolección
  if (rulesResult.intent === 'no_identificado' || rulesResult.action === 'transferir_humano') {
    startDataCollection(from, profileName);
    return {
      intent: 'data_collection_start',
      action: 'auto_response',
      response: 'Voy a conectarte con un asesor. Primero necesito algunos datos. ¿Cuál es tu nombre completo?',
      sendAutoReply: true,
      confidence: 0.8
    };
  }

  return rulesResult;
}

// ===== Manejo de asesores =====
function handleAdvisorMessage(text, from) {
  const state = getConversationState(from);
  const activeSession = loadSessions().find(s => s.status === 'active' && s.advisor_phone === from);

  if (!activeSession) {
    if (text.trim() === '/iniciar') {
      setConversationState(from, { type: 'advisor_waiting_phone' });
      return {
        intent: 'advisor_start',
        action: 'auto_response',
        response: 'Para iniciar sesión con un cliente, escribe el número de teléfono del cliente:',
        sendAutoReply: true,
        confidence: 1
      };
    }

    if (state && state.type === 'advisor_waiting_phone') {
      const clientPhone = text.trim();
      const clientExists = messageHistory.some(m => m.from === clientPhone);

      if (!clientExists) {
        clearConversationState(from);
        return {
          intent: 'advisor_not_found',
          action: 'auto_response',
          response: 'No encontré ese número. Sesión cancelada.',
          sendAutoReply: true,
          confidence: 1
        };
      }

      // Crear sesión con el cliente
      const advisor = loadAdvisors().find(a => a.phone === from);
      const sessionId = 'session_' + Date.now();
      const clientMessages = messageHistory.filter(m => m.from === clientPhone);
      const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const recentHistory = clientMessages.filter(m => m.timestamp >= last48h).slice(-10);

      const newSession = {
        id: sessionId,
        advisor_phone: from,
        advisor_name: advisor?.name || 'Asesor',
        client_phone: clientPhone,
        client_data: null, // Se llenará cuando el cliente envíe los datos
        status: 'waiting_client_data',
        started_at: new Date().toISOString(),
        ended_at: null,
        ended_by: null,
        last_client_activity: new Date().toISOString(),
        last_advisor_message_at: null,
        conversation_history: recentHistory.map(m => ({
          from: m.from_number,
          text: m.text,
          timestamp: m.timestamp
        }))
      };

      const sessions = loadSessions();
      sessions.push(newSession);
      saveSessions(sessions);

      clearConversationState(from);
      return {
        intent: 'advisor_ready',
        action: 'auto_response',
        response: `✅ Sesión iniciada con cliente ${clientPhone}. El cliente recibirá una solicitud de datos.`,
        sendAutoReply: true,
        confidence: 1
      };
    }

    return {
      intent: 'advisor_idle',
      action: 'auto_response',
      response: 'No tienes sesión activa. Escribe */iniciar* para comenzar.',
      sendAutoReply: true,
      confidence: 1
    };
  }

  // Con sesión activa
  if (text.trim() === '/terminar') {
    endSession(activeSession.id, 'advisor');
    return {
      intent: 'advisor_end',
      action: 'auto_response',
      response: '✅ Sesión cerrada.',
      sendAutoReply: true,
      confidence: 1
    };
  }

  // Relay al cliente
  const clientPhone = activeSession.client_phone;
  sendAutoReply(clientPhone, text).catch(e => console.error('Error en relay:', e.message));

  const updatedSessions = loadSessions();
  const idx = updatedSessions.findIndex(s => s.id === activeSession.id);
  if (idx !== -1) {
    updatedSessions[idx].last_advisor_message_at = new Date().toISOString();
    updatedSessions[idx].inactivity_notified = false;
    saveSessions(updatedSessions);
  }

  return {
    intent: 'advisor_relay',
    action: 'relay',
    response: null,
    sendAutoReply: false,
    confidence: 1
  };
}

// ===== Manejo de cliente en sesión =====
function handleClientInSession(text, profileName, from) {
  const sessions = loadSessions();
  const session = sessions.find(s => s.status === 'active' && s.client_phone === from);

  if (!session) return null;

  // Actualizar timestamps y resetear flag de inactividad
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx !== -1) {
    sessions[idx].last_client_activity = new Date().toISOString();
    sessions[idx].inactivity_notified = false;
    saveSessions(sessions);
  }

  // Relay al asesor
  sendAutoReply(session.advisor_phone, `[Cliente ${profileName}]: ${text}`).catch(e =>
    console.error('Error en relay client:', e.message)
  );

  return {
    intent: 'session_relay',
    action: 'relay',
    response: null,
    sendAutoReply: false,
    confidence: 1
  };
}

// ===== Recolección de datos del cliente =====
async function handleDataCollection(text, profileName, from) {
  const state = getConversationState(from);
  const STEPS = ['nombre', 'correo', 'telefono', 'identificacion', 'pregunta'];
  const PROMPTS = {
    nombre: '¿Cuál es tu nombre completo?',
    correo: '¿Cuál es tu correo electrónico?',
    telefono: '¿Cuál es tu número de teléfono?',
    identificacion: '¿Cuál es tu número de identificación?',
    pregunta: '¿Cuál es tu pregunta o consulta?'
  };

  if (!state.collected) state.collected = {};
  state.collected[state.step] = text;

  const currentIdx = STEPS.indexOf(state.step);
  const nextIdx = currentIdx + 1;

  if (nextIdx < STEPS.length) {
    // Hay más pasos
    const nextStep = STEPS[nextIdx];
    setConversationState(from, {
      type: 'data_collection',
      step: nextStep,
      collected: state.collected
    });
    return {
      intent: 'data_collection',
      action: 'auto_response',
      response: PROMPTS[nextStep],
      sendAutoReply: true,
      confidence: 0.8
    };
  }

  // Todos los datos recolectados — asignar asesor
  const advisors = loadAdvisors().filter(a => a.is_active);
  if (advisors.length === 0) {
    clearConversationState(from);
    return {
      intent: 'no_advisors',
      action: 'auto_response',
      response: 'No hay asesores disponibles en este momento. Te contactaremos pronto.',
      sendAutoReply: true,
      confidence: 0.8
    };
  }

  // Crear sesión con primer asesor disponible
  const advisor = advisors[0];
  const sessionId = 'session_' + Date.now();
  const clientData = {
    nombre: state.collected['nombre'],
    correo: state.collected['correo'],
    telefono: state.collected['telefono'],
    identificacion: state.collected['identificacion'],
    pregunta: state.collected['pregunta']
  };

  const newSession = {
    id: sessionId,
    advisor_phone: advisor.phone,
    advisor_name: advisor.name,
    client_phone: from,
    client_data: clientData,
    status: 'active',
    started_at: new Date().toISOString(),
    ended_at: null,
    ended_by: null,
    last_client_activity: new Date().toISOString(),
    last_advisor_message_at: new Date().toISOString(),
    inactivity_notified: false
  };

  const sessions = loadSessions();
  sessions.push(newSession);
  saveSessions(sessions);

  // Notificar al asesor
  const advisorMsg = `🔔 *Nueva sesión iniciada*\n\n👤 *Cliente:* ${clientData.nombre}\n📧 *Correo:* ${clientData.correo}\n📱 *Teléfono:* ${clientData.telefono}\n🪪 *Identificación:* ${clientData.identificacion}\n❓ *Consulta:* ${clientData.pregunta}\n\nResponde directamente a este chat. Escribe */terminar* para cerrar la sesión.`;
  sendAutoReply(advisor.phone, advisorMsg).catch(e => console.error('Error notificando asesor:', e.message));

  clearConversationState(from);
  return {
    intent: 'session_created',
    action: 'auto_response',
    response: '✅ Conectando con un asesor. Por favor espera...',
    sendAutoReply: true,
    confidence: 0.9
  };
}

// ===== Iniciar recolección de datos =====
function startDataCollection(from, profileName) {
  setConversationState(from, {
    type: 'data_collection',
    step: 'nombre',
    collected: {}
  });
}

// ===== Finalizar sesión =====
function endSession(sessionId, reason) {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return;

  const session = sessions[idx];
  sessions[idx] = {
    ...session,
    status: 'completed',
    ended_at: new Date().toISOString(),
    ended_by: reason
  };

  // Notificar cliente
  sendAutoReply(session.client_phone, 'La sesión con el asesor ha finalizado. ¡Gracias por contactarnos!').catch(e =>
    console.error('Error notificando cliente:', e.message)
  );

  // Notificar asesor (solo si no lo cerró él)
  if (reason !== 'advisor') {
    sendAutoReply(session.advisor_phone, 'Sesión finalizada por inactividad del cliente.').catch(e =>
      console.error('Error notificando asesor:', e.message)
    );
  }

  saveSessions(sessions);
  clearConversationState(session.advisor_phone);
  console.log(`✅ Sesión ${sessionId} finalizada (${reason})`);
}

// ===== Flujo multi-paso: procesar follow-ups activos =====
function handleFollowUpFlow(text, profileName, from) {
  if (!from) return null;
  const state = getConversationState(from);
  if (!state) return null;

  const responses = loadResponses();
  const response = responses.find(r => r.id === state.response_id);
  if (!response || !response.follow_ups || !response.follow_ups.length) {
    clearConversationState(from);
    return null;
  }

  // Buscar el step actual
  const step = response.follow_ups.find(f => f.step === state.current_step);
  if (!step) {
    clearConversationState(from);
    return null;
  }

  // Si el step tiene condición, verificar que el contexto previo la cumple
  if (step.condition) {
    const prevSelections = Object.values(state.context || {});
    if (!prevSelections.some(v => normalize(v) === normalize(step.condition))) {
      // Esta rama no aplica — buscar siguiente step sin condition o que aplique
      const nextStep = findNextValidStep(response.follow_ups, state.current_step + 1, state.context);
      if (nextStep) {
        setConversationState(from, { ...state, current_step: nextStep.step });
        return handleFollowUpFlow(text, profileName, from);
      }
      clearConversationState(from);
      return null;
    }
  }

  // Matchear la respuesta del cliente contra trigger_words del step
  const normalizedText = normalize(text);
  const triggers = (step.trigger_words || '').split(',').map(t => normalize(t.trim())).filter(Boolean);
  let matchedKey = null;

  for (const t of triggers) {
    if (normalizedText.includes(t)) {
      matchedKey = t;
      break;
    }
  }

  if (matchedKey) {
    // Buscar la respuesta específica en response_map
    const responseText = (step.response_map && step.response_map[matchedKey])
      ? step.response_map[matchedKey].replace(/\{nombre\}/g, profileName)
      : step.default_response || 'Gracias por tu respuesta.';

    // Guardar selección en el contexto
    const newContext = { ...state.context, [`step_${state.current_step}`]: matchedKey };

    // Buscar siguiente step válido
    const nextStep = findNextValidStep(response.follow_ups, state.current_step + 1, newContext);

    if (nextStep) {
      // Hay más pasos — avanzar
      setConversationState(from, {
        response_id: state.response_id,
        current_step: nextStep.step,
        context: newContext
      });
      // Agregar la pregunta del siguiente paso a la respuesta
      const optionsText = nextStep.options && nextStep.options.length
        ? '\n\nOpciones: ' + nextStep.options.join(' | ')
        : '';
      return {
        intent: response.intent || 'follow_up',
        action: 'auto_response',
        response: responseText + optionsText,
        sendAutoReply: true,
        confidence: 0.95,
        source: 'flow',
        flow_step: state.current_step
      };
    } else {
      // Flujo terminado
      clearConversationState(from);
      console.log(`✅ Flujo completado para ${from} (respuesta ${response.name})`);
      return {
        intent: response.intent || 'follow_up_complete',
        action: 'auto_response',
        response: responseText,
        sendAutoReply: true,
        confidence: 0.95,
        source: 'flow_complete',
        flow_step: state.current_step
      };
    }
  } else {
    // No matcheó — enviar default_response sin avanzar
    const optionsText = step.options && step.options.length
      ? '\n\nOpciones: ' + step.options.join(' | ')
      : '';
    return {
      intent: response.intent || 'follow_up',
      action: 'auto_response',
      response: (step.default_response || 'No entendí tu selección.').replace(/\{nombre\}/g, profileName) + optionsText,
      sendAutoReply: true,
      confidence: 0.5,
      source: 'flow_retry',
      flow_step: state.current_step
    };
  }
}

// Buscar siguiente step válido según el contexto acumulado
function findNextValidStep(followUps, fromStep, context) {
  const contextValues = Object.values(context || {}).map(v => normalize(v));
  for (const step of followUps) {
    if (step.step < fromStep) continue;
    if (!step.condition) return step; // Sin condición — siempre válido
    if (contextValues.some(v => v === normalize(step.condition))) return step;
  }
  return null;
}

// Matching de reglas (puede iniciar flujos nuevos)
function analyzeMessageRules(text, profileName, from) {
  const normalizedText = normalize(text);
  const responses = loadResponses();

  const active = responses
    .filter(r => r.is_active)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  for (const r of active) {
    const triggers = (r.trigger_words || '').split(',').map(t => normalize(t.trim())).filter(Boolean);
    if (triggers.some(t => normalizedText.includes(t))) {
      let responseText = r.response_text.replace(/\{nombre\}/g, profileName);

      // Si tiene follow-ups, iniciar flujo
      if (from && r.follow_ups && r.follow_ups.length > 0) {
        const firstStep = r.follow_ups.find(f => f.step === 1);
        if (firstStep) {
          setConversationState(from, {
            response_id: r.id,
            current_step: 1,
            context: {}
          });
          const optionsText = firstStep.options && firstStep.options.length
            ? '\n\nOpciones: ' + firstStep.options.join(' | ')
            : '';
          responseText += optionsText;
          console.log(`🔄 Flujo iniciado para ${from}: ${r.name} (${r.follow_ups.length} pasos)`);
        }
      }

      return {
        intent: r.intent || 'no_identificado',
        action: 'auto_response',
        response: responseText,
        sendAutoReply: true,
        confidence: 0.9,
        matched_id: r.id
      };
    }
  }

  // Fallback
  const fallback = active.find(r => r.intent === 'no_identificado');
  return {
    intent: 'no_identificado',
    action: 'transferir_humano',
    response: fallback ? fallback.response_text.replace(/\{nombre\}/g, profileName) : `Hola ${profileName}, un especialista te contactará en breve.`,
    sendAutoReply: true,
    confidence: 0.3
  };
}

// Función para enviar respuesta automática
async function sendAutoReply(to, message) {
  try {
    // Enviar al middleware para que lo reenvíe a WhatsApp
    const response = await axios.post('http://localhost:3000/send-message', {
      to,
      message
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    return {
      success: true,
      responseData: response.data
    };
    
  } catch (error) {
    console.error('Error enviando respuesta automática:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Función para palabras comunes
function getCommonWords() {
  const words = {};
  messageHistory.forEach(msg => {
    const textWords = msg.text.toLowerCase().split(/\s+/);
    textWords.forEach(word => {
      if (word.length > 3) { // Ignorar palabras muy cortas
        words[word] = (words[word] || 0) + 1;
      }
    });
  });
  
  // Ordenar por frecuencia
  return Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

// ===== Timer de inactividad de sesiones =====
setInterval(() => {
  const sessions = loadSessions();
  const now = Date.now();

  sessions.forEach(s => {
    if (s.status !== 'active' || !s.last_advisor_message_at) return;
    const lastAdvisor = new Date(s.last_advisor_message_at).getTime();
    const lastClient = new Date(s.last_client_activity).getTime();
    if (lastClient >= lastAdvisor) return; // cliente ya respondió
    if (now - lastAdvisor > SESSION_INACTIVITY_MS) {
      endSession(s.id, 'timeout');
    }
  });
}, 30000);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor webhook simple iniciado en puerto ${PORT}`);
  console.log(`🌐 Webhook URL: http://localhost:${PORT}/webhook/whatsapp-incoming`);
  console.log(`📊 Historial: http://localhost:${PORT}/history`);
  console.log(`📈 Análisis: http://localhost:${PORT}/analysis`);
  console.log(`\n🎯 Listo para recibir mensajes de WhatsApp Business!`);
  console.log(`💡 Envía un mensaje a tu numero de WhatsApp Business para probar`);
});

// Manejar cierre
process.on('SIGINT', () => {
  console.log('\n📊 RESUMEN FINAL:');
  console.log(`   Mensajes recibidos: ${messageHistory.length}`);
  console.log(`   Respuestas enviadas: ${responseLog.length}`);
  process.exit(0);
});