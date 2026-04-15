#!/usr/bin/env node

/**
 * Servidor API avanzado para el panel de WhatsApp Business
 * Incluye: Editor de respuestas, integración con IA, sub-agentes
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

const app = express();
const PORT = 3004;
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(PROJECT_ROOT, 'public')));

// Asegurar que el directorio existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cargar datos
function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_FILE)) {
            return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error cargando mensajes:', error);
    }
    return [];
}

function loadResponses() {
    try {
        if (fs.existsSync(RESPONSES_FILE)) {
            return JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error cargando respuestas:', error);
    }
    return [];
}

// Guardar datos
function saveResponses(responses) {
    try {
        fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error guardando respuestas:', error);
        return false;
    }
}

// Endpoints de API
app.get('/api/messages', (req, res) => {
    const allMessages = loadMessages();
    const limit = parseInt(req.query.limit) || allMessages.length;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';

    let filtered = allMessages;
    if (search) {
        const s = search.toLowerCase();
        filtered = allMessages.filter(m =>
            (m.text || '').toLowerCase().includes(s) ||
            (m.from_number || '').includes(s)
        );
    }

    const sorted = filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const messages = sorted.slice(offset, offset + limit);

    res.json({
        messages,
        pagination: {
            total: filtered.length,
            limit,
            offset,
            page: Math.floor(offset / limit) + 1,
            pages: Math.ceil(filtered.length / limit)
        }
    });
});

app.get('/api/stats', (req, res) => {
    const messages = loadMessages();
    const responses = loadResponses();
    const today = new Date().toISOString().split('T')[0];
    const todayMessages = messages.filter(m => (m.timestamp || '').startsWith(today));

    const intentCounts = {};
    messages.forEach(m => {
        const intent = m.intent || 'no_identificado';
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });

    const senderCounts = {};
    messages.forEach(m => {
        const from = m.from_number || 'desconocido';
        senderCounts[from] = (senderCounts[from] || 0) + 1;
    });

    res.json({
        total_messages: messages.length,
        today_messages: todayMessages.length,
        active_responses: responses.filter(r => r.is_active).length,
        intent_distribution: Object.entries(intentCounts).map(([intent, count]) => ({ intent, count })),
        top_senders: Object.entries(senderCounts)
            .map(([from_number, message_count]) => ({ from_number, message_count }))
            .sort((a, b) => b.message_count - a.message_count)
            .slice(0, 10),
        response_stats: responses.map(r => ({
            name: r.name,
            use_count: r.use_count || 0,
            success_rate: r.success_rate || 0
        }))
    });
});

app.post('/api/test-response', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const responses = loadResponses();
    const lowerMsg = message.toLowerCase();

    let matched = null;
    for (const r of responses.sort((a, b) => (a.priority || 99) - (b.priority || 99))) {
        if (!r.is_active) continue;
        const triggers = (r.trigger_words || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (triggers.some(t => lowerMsg.includes(t))) {
            matched = r;
            break;
        }
    }

    res.json({
        intent: matched?.intent || 'no_identificado',
        suggested_response: matched?.response_text || 'No se encontro una respuesta configurada para este mensaje.',
        matched_response: matched ? { name: matched.name, id: matched.id } : null
    });
});

app.get('/api/responses', (req, res) => {
    const responses = loadResponses();
    res.json(responses);
});

app.post('/api/save-responses', (req, res) => {
    const { responses } = req.body;
    
    if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ error: 'Formato de respuestas inválido' });
    }
    
    const success = saveResponses(responses);
    
    if (success) {
        res.json({ success: true, count: responses.length });
    } else {
        res.status(500).json({ error: 'Error guardando respuestas' });
    }
});

app.post('/api/analyze-message', async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Mensaje requerido' });
    }
    
    try {
        // Enviar al webhook simple para análisis
        const webhookResponse = await fetch('http://localhost:5678/webhook/whatsapp-incoming', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messageData: {
                    messages: [{
                        from: 'api-user',
                        id: 'api-' + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000),
                        text: { body: message },
                        type: 'text'
                    }],
                    contacts: [{
                        profile: { name: 'API User' },
                        wa_id: 'api-user'
                    }]
                }
            })
        });
        
        const analysis = await webhookResponse.json();
        res.json(analysis);
        
    } catch (error) {
        console.error('Error analizando mensaje:', error);
        res.status(500).json({ error: 'Error analizando mensaje', details: error.message });
    }
});

// Endpoint de analisis de cobertura para entrenamiento
app.post('/api/train-analyze', (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Se requiere un array de mensajes' });
    }

    const responses = loadResponses();
    const results = messages.map(msg => {
        const lowerMsg = msg.toLowerCase();
        let matched = null;

        for (const r of responses.sort((a, b) => (a.priority || 99) - (b.priority || 99))) {
            if (!r.is_active) continue;
            const triggers = (r.trigger_words || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            if (triggers.some(t => lowerMsg.includes(t))) {
                matched = r;
                break;
            }
        }

        return {
            message: msg,
            matched: !!matched,
            intent: matched?.intent || null,
            response_name: matched?.name || null
        };
    });

    const matched = results.filter(r => r.matched).length;
    const total = results.length;

    res.json({
        results,
        coverage: total > 0 ? Math.round((matched / total) * 100) : 0,
        matched,
        unmatched: total - matched,
        total
    });
});


app.post('/api/send-test-whatsapp', async (req, res) => {
    const { to, text } = req.body;
    
    if (!to || !text) {
        return res.status(400).json({ error: 'Destinatario y texto requeridos' });
    }
    
    try {
        // Enviar al middleware para que lo procese
        const middlewareResponse = await fetch('http://localhost:3000/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, message: text })
        });
        
        if (middlewareResponse.ok) {
            res.json({ success: true, message: 'Mensaje enviado para procesamiento' });
        } else {
            throw new Error('Error en middleware');
        }
        
    } catch (error) {
        console.error('Error enviando prueba:', error);
        res.status(500).json({ error: 'Error enviando mensaje', details: error.message });
    }
});

// ==================== CONVERSACIONES ====================

// Lista de conversaciones agrupadas por número
app.get('/api/conversations', (req, res) => {
    const messages = loadMessages();
    const convMap = {};

    messages.forEach(m => {
        const num = m.from_number || 'desconocido';
        if (!convMap[num]) convMap[num] = [];
        convMap[num].push(m);
    });

    const conversations = Object.entries(convMap).map(([num, msgs]) => {
        msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const last = msgs[msgs.length - 1];
        return {
            from_number: num,
            message_count: msgs.length,
            last_message: last.text || '',
            last_timestamp: last.timestamp,
            last_intent: last.intent
        };
    });

    conversations.sort((a, b) => new Date(b.last_timestamp) - new Date(a.last_timestamp));
    res.json({ conversations });
});

// Thread de una conversación con burbujas incoming/outgoing
app.get('/api/conversations/:phoneNumber', (req, res) => {
    const phoneNumber = req.params.phoneNumber;
    const messages = loadMessages();
    const filtered = messages
        .filter(m => m.from_number === phoneNumber)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const thread = [];
    filtered.forEach(m => {
        thread.push({
            id: m.id,
            type: 'incoming',
            from_number: m.from_number,
            text: m.text,
            timestamp: m.timestamp,
            intent: m.intent,
            message_id: m.message_id
        });

        if (m.response_sent) {
            const respTime = new Date(new Date(m.timestamp).getTime() + 1000).toISOString();
            thread.push({
                id: m.id + '_resp',
                type: 'outgoing',
                from_number: 'bot',
                text: m.response_sent,
                timestamp: respTime,
                intent: m.intent
            });
        }
    });

    res.json({ from_number: phoneNumber, message_count: filtered.length, thread });
});

// Exportar una conversación
app.get('/api/conversations/:phoneNumber/export', (req, res) => {
    const phoneNumber = req.params.phoneNumber;
    const format = req.query.format || 'json';
    const messages = loadMessages();
    const filtered = messages
        .filter(m => m.from_number === phoneNumber)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (format === 'txt') {
        let text = `Conversacion con ${phoneNumber}\n`;
        text += `Exportado: ${new Date().toISOString()}\n`;
        text += '='.repeat(50) + '\n\n';
        filtered.forEach(m => {
            const date = new Date(m.timestamp).toLocaleString('es-CO');
            text += `[${date}] ${m.from_number}: ${m.text}\n`;
            if (m.response_sent) {
                text += `[${date}] Bot: ${m.response_sent}\n`;
            }
            text += '\n';
        });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="conversacion_${phoneNumber}.txt"`);
        res.send(text);
    } else {
        res.setHeader('Content-Disposition', `attachment; filename="conversacion_${phoneNumber}.json"`);
        res.json({ from_number: phoneNumber, exported_at: new Date().toISOString(), messages: filtered });
    }
});

// Endpoint de estado
app.get('/api/status', (req, res) => {
    const messages = loadMessages();
    const responses = loadResponses();
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stats: {
            totalMessages: messages.length,
            totalResponses: responses.length,
            activeResponses: responses.filter(r => r.is_active).length,
            responseRate: messages.length > 0 ? 
                Math.round((messages.filter(m => m.response_sent).length / messages.length) * 100) : 0
        },
        services: {
            middleware: 'http://localhost:3000',
            webhook: 'http://localhost:5678',
            api: `http://localhost:${PORT}`,
            panel: 'http://localhost:3002'
        }
    });
});

// ==================== NGROK MANAGEMENT ====================

const NGROK_CONFIG_PATH = path.join(
    process.env.HOME, 'Library', 'Application Support', 'ngrok', 'ngrok.yml'
);
const NGROK_API = 'http://localhost:4040';

// Helper: fetch ngrok local API
function ngrokFetch(urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.get(`${NGROK_API}${urlPath}`, { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// GET /api/ngrok/status — real-time tunnel status
app.get('/api/ngrok/status', async (req, res) => {
    const tunnels = await ngrokFetch('/api/tunnels');
    const isRunning = tunnels !== null;
    let tunnel = null;
    let metrics = null;

    if (isRunning && tunnels.tunnels && tunnels.tunnels.length > 0) {
        const t = tunnels.tunnels[0];
        tunnel = {
            name: t.name,
            public_url: t.public_url,
            proto: t.proto,
            addr: t.config?.addr,
            id: t.ID
        };
        metrics = {
            connections: t.metrics?.conns?.count || 0,
            http_requests: t.metrics?.http?.count || 0,
            active_connections: t.metrics?.conns?.gauge || 0,
            p50_latency_ms: Math.round((t.metrics?.http?.p50 || 0) / 1e6),
            p90_latency_ms: Math.round((t.metrics?.http?.p90 || 0) / 1e6),
            p99_latency_ms: Math.round((t.metrics?.http?.p99 || 0) / 1e6)
        };
    }

    // Read authtoken from config
    let authtoken = '';
    try {
        const cfg = fs.readFileSync(NGROK_CONFIG_PATH, 'utf8');
        const match = cfg.match(/authtoken:\s*(.+)/);
        if (match) authtoken = match[1].trim();
    } catch {}

    // Get ngrok PID
    let pid = null;
    try {
        const pidOut = execSync('pgrep -f "ngrok http"', { timeout: 3000 }).toString().trim();
        pid = pidOut.split('\n')[0] || null;
    } catch {}

    res.json({
        running: isRunning && tunnel !== null,
        process_alive: pid !== null,
        pid: pid ? parseInt(pid) : null,
        tunnel,
        metrics,
        authtoken_masked: authtoken ? authtoken.slice(0, 8) + '...' + authtoken.slice(-6) : null,
        authtoken_set: !!authtoken,
        timestamp: new Date().toISOString()
    });
});

// POST /api/ngrok/start — start ngrok tunnel
app.post('/api/ngrok/start', (req, res) => {
    const { port } = req.body;
    const targetPort = port || 3000;

    // Check if already running
    try {
        execSync('pgrep -f "ngrok http"', { timeout: 3000 });
        return res.status(409).json({ error: 'Ngrok ya esta corriendo. Detenerlo primero.' });
    } catch {}

    const logFile = path.join(PROJECT_ROOT, 'logs', 'ngrok.log');
    const ngrok = spawn('ngrok', ['http', String(targetPort), '--log=stdout'], {
        detached: true,
        stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')]
    });
    ngrok.unref();

    // Save PID
    fs.writeFileSync(path.join(PROJECT_ROOT, 'logs', 'ngrok.pid'), String(ngrok.pid));

    res.json({ success: true, pid: ngrok.pid, port: targetPort });
});

// POST /api/ngrok/stop — graceful stop
app.post('/api/ngrok/stop', (req, res) => {
    try {
        const pidOut = execSync('pgrep -f "ngrok http"', { timeout: 3000 }).toString().trim();
        const pids = pidOut.split('\n').filter(Boolean);
        pids.forEach(pid => {
            try { process.kill(parseInt(pid), 'SIGTERM'); } catch {}
        });
        res.json({ success: true, stopped: pids.length });
    } catch {
        res.json({ success: true, stopped: 0, message: 'Ngrok no estaba corriendo' });
    }
});

// POST /api/ngrok/kill — force kill
app.post('/api/ngrok/kill', (req, res) => {
    try {
        execSync('pkill -9 -f "ngrok http"', { timeout: 3000 });
        res.json({ success: true, force: true });
    } catch {
        res.json({ success: true, message: 'Ngrok no estaba corriendo' });
    }
});

// POST /api/ngrok/restart — stop then start
app.post('/api/ngrok/restart', async (req, res) => {
    const { port } = req.body;
    const targetPort = port || 3000;

    // Kill existing
    try { execSync('pkill -f "ngrok http"', { timeout: 3000 }); } catch {}

    // Wait for port to free
    await new Promise(r => setTimeout(r, 2000));

    const logFile = path.join(PROJECT_ROOT, 'logs', 'ngrok.log');
    const ngrok = spawn('ngrok', ['http', String(targetPort), '--log=stdout'], {
        detached: true,
        stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')]
    });
    ngrok.unref();
    fs.writeFileSync(path.join(PROJECT_ROOT, 'logs', 'ngrok.pid'), String(ngrok.pid));

    res.json({ success: true, pid: ngrok.pid, port: targetPort });
});

// POST /api/ngrok/authtoken — update authtoken
app.post('/api/ngrok/authtoken', (req, res) => {
    const { authtoken } = req.body;
    if (!authtoken || authtoken.length < 10) {
        return res.status(400).json({ error: 'Authtoken invalido' });
    }

    try {
        execSync(`ngrok config add-authtoken ${authtoken}`, { timeout: 10000 });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando authtoken', details: error.message });
    }
});

// GET /api/ngrok/log — last N lines of ngrok log
app.get('/api/ngrok/log', (req, res) => {
    const logFile = path.join(PROJECT_ROOT, 'logs', 'ngrok.log');
    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(Boolean).slice(-50);
        res.json({ lines });
    } catch {
        res.json({ lines: [] });
    }
});

// ==================== CONVERSATION STATES ====================

const CONV_STATES_FILE = path.join(DATA_DIR, 'conversation-states.json');
const ADVISORS_FILE = path.join(DATA_DIR, 'advisors.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function loadConvStates() {
    try {
        if (fs.existsSync(CONV_STATES_FILE)) {
            return JSON.parse(fs.readFileSync(CONV_STATES_FILE, 'utf8'));
        }
    } catch {}
    return {};
}

function loadAdvisors() {
    try {
        if (fs.existsSync(ADVISORS_FILE)) {
            return JSON.parse(fs.readFileSync(ADVISORS_FILE, 'utf8'));
        }
    } catch {}
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
    } catch {}
    return [];
}

function saveSessions(sessions) {
    const tmpFile = SESSIONS_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(sessions, null, 2), 'utf8');
    fs.renameSync(tmpFile, SESSIONS_FILE);
}

// GET /api/conversation-states — estados activos de flujos
app.get('/api/conversation-states', (req, res) => {
    const states = loadConvStates();
    const responses = loadResponses();
    const result = Object.entries(states).map(([phone, state]) => {
        const resp = responses.find(r => r.id === state.response_id);
        return {
            phone,
            response_name: resp?.name || 'Desconocida',
            response_id: state.response_id,
            current_step: state.current_step,
            context: state.context,
            last_activity: state.last_activity
        };
    });
    res.json({ states: result, total: result.length });
});

// DELETE /api/conversation-states/:phone — reset manual
app.delete('/api/conversation-states/:phone', (req, res) => {
    const states = loadConvStates();
    delete states[req.params.phone];
    const tmpFile = CONV_STATES_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(states, null, 2), 'utf8');
    fs.renameSync(tmpFile, CONV_STATES_FILE);
    res.json({ success: true });
});

// ==================== IA / OPENCLAW ====================

const AIClient = require('../lib/ai-client');
const aiClient = new AIClient();

// GET /api/ai/config
app.get('/api/ai/config', (req, res) => {
    res.json(aiClient.loadConfig());
});

// POST /api/ai/install — guarda configuración del wizard
app.post('/api/ai/install', (req, res) => {
    const { providers, activeBrain, systemPrompt, securityRules } = req.body;
    if (!providers || !activeBrain) {
        return res.status(400).json({ error: 'providers y activeBrain son requeridos' });
    }
    const config = aiClient.getDefaultConfig();
    config.installed = true;
    config.enabled = false;
    config.providers = providers;
    config.activeBrain = activeBrain;
    config.systemPrompt = systemPrompt || '';
    config.securityRules = securityRules || config.securityRules;
    config.installedAt = new Date().toISOString();
    aiClient.saveConfig(config);
    res.json({ success: true, config });
});

// POST /api/ai/toggle
app.post('/api/ai/toggle', (req, res) => {
    const { enabled } = req.body;
    const config = aiClient.loadConfig();
    config.enabled = !!enabled;
    aiClient.saveConfig(config);
    res.json({ success: true, enabled: config.enabled });
});

// POST /api/ai/switch-brain
app.post('/api/ai/switch-brain', (req, res) => {
    const { brain } = req.body;
    if (!brain) return res.status(400).json({ error: 'brain requerido' });
    const config = aiClient.loadConfig();
    const providerId = brain.split(':')[0];
    if (!config.providers[providerId]) {
        return res.status(400).json({ error: `Proveedor "${providerId}" no instalado` });
    }
    config.activeBrain = brain;
    aiClient.saveConfig(config);
    res.json({ success: true, activeBrain: brain });
});

// POST /api/ai/system-prompt
app.post('/api/ai/system-prompt', (req, res) => {
    const { prompt } = req.body;
    if (prompt === undefined) return res.status(400).json({ error: 'prompt requerido' });
    const config = aiClient.loadConfig();
    config.systemPrompt = prompt;
    aiClient.saveConfig(config);
    res.json({ success: true });
});

// POST /api/ai/chat — chat con la IA (modo entrenamiento o modo libre)
app.post('/api/ai/chat', async (req, res) => {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array requerido' });
    }

    const config = aiClient.loadConfig();
    if (!config.installed || !config.activeBrain) {
        return res.status(400).json({ error: 'IA no instalada o sin cerebro activo' });
    }

    let systemPrompt = config.systemPrompt || '';

    if (context === 'training') {
        // Inyectar las respuestas actuales para que la IA las conozca
        const currentResponses = loadResponses();
        const responseSummary = currentResponses.map(r => {
            const fuCount = r.follow_ups?.length || 0;
            const ctx = r.ai_context ? ` | contexto_ia:"${r.ai_context.substring(0, 100)}..."` : '';
            return `  - id:${r.id} | intent:"${r.intent}" | triggers:"${r.trigger_words}" | respuesta:"${r.response_text?.substring(0, 80)}..." | activa:${r.is_active} | follow_ups:${fuCount} pasos${ctx}`;
        }).join('\n');

        systemPrompt += `\n\n=== RESPUESTAS AUTOMÁTICAS ACTUALES (data/responses.json) ===
Estas son las respuestas configuradas actualmente en el sistema. Debes conocerlas para no crear duplicados y para poder editarlas o eliminarlas por su id:
${responseSummary || '(Ninguna respuesta configurada todavía)'}
=== FIN RESPUESTAS ===

Eres el asistente de configuración del bot de WhatsApp. Tu trabajo es gestionar las respuestas automáticas del archivo responses.json.

REGLAS:
1. Cuando el usuario pida AGREGAR una respuesta nueva, genera un bloque JSON con action:"add"
2. Cuando pida EDITAR una existente, usa action:"edit" con el "id" de la respuesta
3. Cuando pida ELIMINAR, usa action:"delete" con el "id"
4. Siempre revisa las respuestas actuales antes de agregar — NO crees duplicados
5. Los trigger_words deben ser palabras clave separadas por comas, en minúsculas, sin acentos
6. Responde siempre en español, de forma breve

Formato del bloque JSON (incluirlo al final de tu respuesta):
\`\`\`json
{"action":"add","name":"Nombre","intent":"nombre_intent","trigger_words":"palabra1,palabra2","response_text":"Texto completo de la respuesta"}
\`\`\`
Para editar: {"action":"edit","id":123,"trigger_words":"nuevas,palabras","response_text":"Nuevo texto"}
Para eliminar: {"action":"delete","id":123}

Para agregar follow-ups (flujo multi-paso) a una respuesta nueva o existente:
{"action":"add","name":"...","follow_ups":[{"step":1,"question":"¿Pregunta?","options":["A","B"],"trigger_words":"a,b","response_map":{"a":"Respuesta A","b":"Respuesta B"},"default_response":"No entendí, elige A o B"}]}
Para editar follow-ups: {"action":"edit","id":123,"follow_ups":[...]}

Cada respuesta puede tener un campo "ai_context" con información específica para que la IA responda sin inventar.
Para agregar/editar contexto: {"action":"edit","id":123,"ai_context":"Precios: Casio $10.000, Citizen $15.000. Horario: Lun-Vie 9am-7pm."}
Para agregar con contexto: {"action":"add","name":"...","ai_context":"información específica aquí","response_text":"...","trigger_words":"..."}

Si el usuario NO pide cambios en respuestas, NO incluyas ningún bloque JSON.`;
    }

    try {
        const reply = await aiClient.chat(messages, { systemPrompt, timeout: 15000 });

        // Parsear bloques JSON si hay cambios de entrenamiento
        const changes = [];
        if (context === 'training') {
            const jsonMatches = reply.match(/```json\n([\s\S]*?)\n```/g) || [];
            for (const block of jsonMatches) {
                try {
                    const jsonStr = block.replace(/```json\n/, '').replace(/\n```/, '');
                    const action = JSON.parse(jsonStr);
                    const responses = loadResponses();

                    if (action.action === 'add') {
                        const newResp = {
                            id: Date.now(),
                            name: action.name || 'Nueva respuesta',
                            intent: action.intent || 'no_identificado',
                            trigger_words: action.trigger_words || '',
                            response_text: action.response_text || '',
                            is_active: true,
                            priority: action.priority || 50,
                            ai_context: action.ai_context || '',
                            follow_ups: action.follow_ups || [],
                            use_count: 0,
                            success_rate: 0
                        };
                        responses.push(newResp);
                        saveResponses(responses);
                        changes.push({ action: 'add', response: newResp });
                    } else if (action.action === 'edit' && action.id) {
                        const idx = responses.findIndex(r => r.id == action.id);
                        if (idx !== -1) {
                            Object.assign(responses[idx], action);
                            saveResponses(responses);
                            changes.push({ action: 'edit', response: responses[idx] });
                        }
                    } else if (action.action === 'delete' && action.id) {
                        const idx = responses.findIndex(r => r.id == action.id);
                        if (idx !== -1) {
                            const deleted = responses.splice(idx, 1)[0];
                            saveResponses(responses);
                            changes.push({ action: 'delete', response: deleted });
                        }
                    }
                } catch (e) {
                    console.error('Error parseando bloque JSON del AI:', e.message);
                }
            }
        }

        // Limpiar bloques JSON del reply visible
        const cleanReply = reply.replace(/```json\n[\s\S]*?\n```/g, '').trim();
        res.json({ reply: cleanReply, changes });

    } catch (error) {
        console.error('Error en chat AI:', error.message);
        res.status(500).json({ error: 'Error comunicándose con la IA', details: error.message });
    }
});

// GET /api/ai/providers — lista proveedores con health
app.get('/api/ai/providers', async (req, res) => {
    const config = aiClient.loadConfig();
    const providerDefaults = aiClient.getProviderDefaults();
    const result = [];

    for (const [id, provider] of Object.entries(config.providers)) {
        const defaults = providerDefaults[id] || {};
        const health = await aiClient.testProvider(id);
        result.push({
            id,
            name: defaults.name || provider.name || id,
            type: provider.type,
            baseUrl: provider.baseUrl,
            apiKeyMasked: provider.apiKey
                ? provider.apiKey.slice(0, 6) + '...' + provider.apiKey.slice(-4)
                : null,
            models: provider.models || defaults.models || [],
            healthy: health.success,
            latencyMs: health.latencyMs,
            error: health.error || null
        });
    }

    res.json({ providers: result });
});

// POST /api/ai/providers/:id/test
app.post('/api/ai/providers/:id/test', async (req, res) => {
    const result = await aiClient.testProvider(req.params.id);
    res.json(result);
});

// GET /api/ai/integrations
app.get('/api/ai/integrations', (req, res) => {
    const config = aiClient.loadConfig();
    res.json({ integrations: config.integrations || [] });
});

// POST /api/ai/integrations — agregar o actualizar
app.post('/api/ai/integrations', (req, res) => {
    const { id, name, baseUrl, authType, authValue, description, dataCategory } = req.body;
    if (!name || !baseUrl) return res.status(400).json({ error: 'name y baseUrl requeridos' });

    const config = aiClient.loadConfig();
    const integrations = config.integrations || [];

    if (id) {
        const idx = integrations.findIndex(i => i.id == id);
        if (idx !== -1) {
            Object.assign(integrations[idx], { name, baseUrl, authType, authValue, description, dataCategory });
        } else {
            integrations.push({ id, name, baseUrl, authType, authValue, description, dataCategory });
        }
    } else {
        integrations.push({ id: Date.now(), name, baseUrl, authType: authType || 'none', authValue: authValue || '', description: description || '', dataCategory: dataCategory || 'public' });
    }

    config.integrations = integrations;
    aiClient.saveConfig(config);
    res.json({ success: true, integrations });
});

// DELETE /api/ai/integrations/:id
app.delete('/api/ai/integrations/:id', (req, res) => {
    const config = aiClient.loadConfig();
    config.integrations = (config.integrations || []).filter(i => String(i.id) !== String(req.params.id));
    aiClient.saveConfig(config);
    res.json({ success: true });
});

// GET /api/ai/ollama/models
app.get('/api/ai/ollama/models', async (req, res) => {
    const result = await aiClient.listOllamaModels();
    res.json(result);
});

// POST /api/ai/ollama/pull
app.post('/api/ai/ollama/pull', async (req, res) => {
    const { model } = req.body;
    if (!model) return res.status(400).json({ error: 'model requerido' });
    const result = await aiClient.pullOllamaModel(model);
    res.json(result);
});

// ==================== ADVISORS / ASESORES ====================

// GET /api/advisors
app.get('/api/advisors', (req, res) => {
    const advisors = loadAdvisors();
    res.json({ advisors });
});

// POST /api/advisors
app.post('/api/advisors', (req, res) => {
    const { name, phone, roles, is_active } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ error: 'name y phone requeridos' });
    }

    const advisors = loadAdvisors();
    const newAdvisor = {
        id: Date.now(),
        name,
        phone,
        roles: roles || [],
        is_active: is_active !== false,
        created_at: new Date().toISOString()
    };

    advisors.push(newAdvisor);
    saveAdvisors(advisors);
    res.json({ success: true, advisor: newAdvisor });
});

// PUT /api/advisors/:id
app.put('/api/advisors/:id', (req, res) => {
    const { name, phone, roles, is_active } = req.body;
    const advisors = loadAdvisors();
    const idx = advisors.findIndex(a => String(a.id) === String(req.params.id));

    if (idx === -1) {
        return res.status(404).json({ error: 'Asesor no encontrado' });
    }

    Object.assign(advisors[idx], { name, phone, roles, is_active });
    saveAdvisors(advisors);
    res.json({ success: true, advisor: advisors[idx] });
});

// DELETE /api/advisors/:id
app.delete('/api/advisors/:id', (req, res) => {
    const advisors = loadAdvisors();
    const filtered = advisors.filter(a => String(a.id) !== String(req.params.id));
    saveAdvisors(filtered);
    res.json({ success: true });
});

// ==================== SESSIONS / SESIONES ====================

// GET /api/sessions
app.get('/api/sessions', (req, res) => {
    const sessions = loadSessions();
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const sorted = sessions.sort((a, b) =>
        new Date(b.started_at) - new Date(a.started_at)
    );

    res.json({
        sessions: sorted.slice(offset, offset + limit),
        pagination: {
            total: sessions.length,
            limit,
            offset,
            page: Math.floor(offset / limit) + 1,
            pages: Math.ceil(sessions.length / limit)
        }
    });
});

// GET /api/sessions/active
app.get('/api/sessions/active', (req, res) => {
    const sessions = loadSessions();
    const active = sessions.filter(s => s.status === 'active');
    res.json({ sessions: active });
});

// DELETE /api/sessions/:id
app.delete('/api/sessions/:id', (req, res) => {
    const sessions = loadSessions();
    const idx = sessions.findIndex(s => s.id === req.params.id);

    if (idx === -1) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const session = sessions[idx];
    session.status = 'completed';
    session.ended_at = new Date().toISOString();
    session.ended_by = 'admin';

    saveSessions(sessions);
    res.json({ success: true });
});

// ==================== SYSTEM CONTROL ====================

const { exec } = require('child_process');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

const SERVICES = {
    middleware: { port: 3000, file: 'src/servers/middleware.js', log: 'logs/middleware.log', pid: 'logs/middleware.pid' },
    webhook: { port: 5678, file: 'src/servers/webhook-simple.js', log: 'logs/webhook.log', pid: 'logs/webhook.pid' },
    api: { port: 3004, file: 'src/servers/api-advanced.js', log: 'logs/api.log', pid: 'logs/api.pid' },
    web: { port: 3002, file: 'src/servers/web-server.js', log: 'logs/web-server.log', pid: 'logs/web-server.pid' },
    ngrok: { port: 4040, log: 'logs/ngrok.log', pid: 'logs/ngrok.pid' }
};

// Auxiliar: comprobar si un puerto tiene proceso
function checkPort(port) {
    return new Promise(resolve => {
        exec(`lsof -ti:${port}`, (err, stdout) => {
            resolve(stdout.trim() ? { alive: true, pid: stdout.trim() } : { alive: false, pid: null });
        });
    });
}

// Auxiliar: leer últimas N líneas de un archivo
function tailLines(filePath, n = 100) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        return lines.slice(Math.max(0, lines.length - n)).filter(l => l.trim());
    } catch (err) {
        return [`Error leyendo log: ${err.message}`];
    }
}

// GET /api/system/status
app.get('/api/system/status', async (req, res) => {
    try {
        const status = {};
        for (const [name, config] of Object.entries(SERVICES)) {
            const check = await checkPort(config.port);
            status[name] = {
                alive: check.alive,
                pid: check.pid,
                port: config.port
            };
        }
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/system/:service/start
app.post('/api/system/:service/start', (req, res) => {
    const service = req.params.service;
    const config = SERVICES[service];
    if (!config) return res.status(400).json({ error: `Servicio '${service}' no existe` });

    if (service === 'ngrok') {
        const envConfig = loadEnvFile();
        const authToken = envConfig.NGROK_AUTH_TOKEN || '';
        const cmd = authToken
            ? `ngrok http 3000 --authtoken ${authToken}`
            : `ngrok http 3000`;
        exec(`${cmd} --log=stdout > ${config.log} 2>&1 &`, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: `${service} iniciado` });
        });
    } else {
        const absFile = path.join(PROJECT_ROOT, config.file);
        const cmd = `node ${absFile} > ${config.log} 2>&1 &`;
        exec(cmd, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            setTimeout(() => {
                checkPort(config.port).then(check => {
                    if (check.pid) {
                        fs.writeFileSync(path.join(PROJECT_ROOT, config.pid), check.pid, 'utf8');
                    }
                    res.json({ success: true, pid: check.pid, message: `${service} iniciado` });
                });
            }, 1000);
        });
    }
});

// POST /api/system/:service/stop
app.post('/api/system/:service/stop', (req, res) => {
    const service = req.params.service;
    const config = SERVICES[service];
    if (!config) return res.status(400).json({ error: `Servicio '${service}' no existe` });

    try {
        const pidFile = path.join(PROJECT_ROOT, config.pid);
        let pid = null;
        if (fs.existsSync(pidFile)) {
            pid = fs.readFileSync(pidFile, 'utf8').trim();
        }

        if (pid) {
            exec(`kill ${pid}`, (err) => {
                if (!err || err.code === 1) {
                    fs.writeFileSync(pidFile, '', 'utf8');
                    res.json({ success: true, message: `${service} detenido (PID: ${pid})` });
                } else {
                    res.status(500).json({ error: err.message });
                }
            });
        } else {
            // Fallback: matar por puerto
            exec(`lsof -ti:${config.port} | xargs kill -9`, (err) => {
                res.json({ success: true, message: `${service} detenido (por puerto ${config.port})` });
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/system/:service/restart
app.post('/api/system/:service/restart', (req, res) => {
    const service = req.params.service;
    const config = SERVICES[service];
    if (!config) return res.status(400).json({ error: `Servicio '${service}' no existe` });

    // Primero detener
    const stopCmd = `kill -9 $(lsof -ti:${config.port}) 2>/dev/null || true`;
    exec(stopCmd, () => {
        setTimeout(() => {
            // Luego iniciar
            if (service === 'ngrok') {
                const envConfig = loadEnvFile();
                const authToken = envConfig.NGROK_AUTH_TOKEN || '';
                const cmd = authToken
                    ? `ngrok http 3000 --authtoken ${authToken}`
                    : `ngrok http 3000`;
                exec(`${cmd} --log=stdout > ${config.log} 2>&1 &`, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: `${service} reiniciado` });
                });
            } else {
                const absFile = path.join(PROJECT_ROOT, config.file);
                const cmd = `node ${absFile} > ${config.log} 2>&1 &`;
                exec(cmd, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: `${service} reiniciado` });
                });
            }
        }, 1500);
    });
});

// GET /api/system/logs/:service?lines=100
app.get('/api/system/logs/:service', (req, res) => {
    const service = req.params.service;
    const config = SERVICES[service];
    if (!config) return res.status(400).json({ error: `Servicio '${service}' no existe` });

    const lines = parseInt(req.query.lines) || 100;
    const logFile = path.join(PROJECT_ROOT, config.log);
    const logs = tailLines(logFile, lines);

    res.json({ service, logs, total: logs.length });
});

// POST /api/system/test/:service
app.post('/api/system/test/:service', async (req, res) => {
    const service = req.params.service;
    const urls = {
        middleware: 'http://localhost:3000/health',
        web: 'http://localhost:3002/',
        api: 'http://localhost:3004/api/stats',
        webhook: 'http://localhost:5678/',
        ngrok: 'http://localhost:4040/api/tunnels'
    };

    const url = urls[service];
    if (!url) return res.status(400).json({ error: `Servicio '${service}' no existe` });

    try {
        const response = await new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data: data.substring(0, 200) }));
            }).on('error', reject);
        });
        res.json({ success: true, service, status: response.status, response: response.data });
    } catch (err) {
        res.status(500).json({ success: false, service, error: err.message });
    }
});

// ==================== CONFIG ====================

function loadEnvFile() {
    try {
        if (!fs.existsSync(ENV_FILE)) return {};
        const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
        const config = {};
        for (const line of lines) {
            if (line.startsWith('#') || !line.includes('=')) continue;
            const [key, ...rest] = line.split('=');
            config[key.trim()] = rest.join('=').trim();
        }
        return config;
    } catch (err) {
        console.error('Error cargando .env:', err);
        return {};
    }
}

function saveEnvFile(config) {
    try {
        const lines = fs.existsSync(ENV_FILE)
            ? fs.readFileSync(ENV_FILE, 'utf8').split('\n')
            : [];

        const result = [];
        const processed = new Set();

        // Actualizar líneas existentes
        for (let line of lines) {
            if (line.startsWith('#') || !line.includes('=')) {
                result.push(line);
            } else {
                const [key] = line.split('=');
                const trimmedKey = key.trim();
                if (config.hasOwnProperty(trimmedKey)) {
                    result.push(`${trimmedKey}=${config[trimmedKey]}`);
                    processed.add(trimmedKey);
                } else {
                    result.push(line);
                }
            }
        }

        // Agregar campos nuevos
        for (const [key, value] of Object.entries(config)) {
            if (!processed.has(key)) {
                result.push(`${key}=${value}`);
            }
        }

        // Escritura atómica
        const tmpFile = ENV_FILE + '.tmp';
        fs.writeFileSync(tmpFile, result.join('\n'), 'utf8');
        fs.renameSync(tmpFile, ENV_FILE);
    } catch (err) {
        console.error('Error guardando .env:', err);
        throw err;
    }
}

// GET /api/config
app.get('/api/config', (req, res) => {
    const config = loadEnvFile();
    res.json(config);
});

// PUT /api/config
app.put('/api/config', (req, res) => {
    try {
        const allowedKeys = [
            'M4D_APP_ID', 'M4D_APP_SECRET', 'WA_PHONE_NUMBER_ID', 'WA_BUSINESS_ACCOUNT_ID',
            'CLOUD_API_ACCESS_TOKEN', 'CLOUD_API_VERSION', 'WHATSAPP_BUSINESS_NUMBER',
            'WEBHOOK_ENDPOINT', 'WEBHOOK_VERIFICATION_TOKEN', 'PORT', 'NGROK_AUTH_TOKEN',
            'OPENCLAW_GATEWAY_URL', 'OPENCLAW_API_TOKEN', 'LOG_LEVEL', 'LOG_FILE'
        ];

        const newConfig = {};
        for (const key of allowedKeys) {
            if (req.body.hasOwnProperty(key)) {
                newConfig[key] = req.body[key];
            }
        }

        saveEnvFile(newConfig);
        res.json({
            success: true,
            message: 'Configuración guardada. Reinicia los servidores para aplicar los cambios.'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`API Avanzada iniciada en http://localhost:${PORT}`);
});