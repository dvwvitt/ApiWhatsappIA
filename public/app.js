// WhatsApp Control Panel - Frontend Application

let currentPage = 1;
const pageSize = 20;
let totalMessages = 0;
let selectedConversation = null;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    // Cargar datos iniciales
    loadDashboard();
    loadMessages();
    loadResponses();
    
    // Configurar eventos
    setupEventListeners();
    
    // Actualizar automáticamente cada 30 segundos
    setInterval(loadDashboard, 30000);
    setInterval(loadMessages, 30000);
    
    // Actualizar hora
    updateTime();
    setInterval(updateTime, 1000);
});

// Configurar event listeners
function setupEventListeners() {
    // Navegación
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            const target = e.target.getAttribute('href');
            if (target === '#dashboard') loadDashboard();
            if (target === '#messages') loadMessages();
            if (target === '#responses') loadResponses();
            if (target === '#stats') loadStats();
            if (target === '#conversaciones') loadConversations();
            if (target === '#training') loadTrainingPanel();
            if (target === '#tunnel') { loadTunnelStatus(); loadTunnelLog(); }
            if (target === '#ai-management') loadAIManagement();
            if (target === '#advisors') { loadAdvisors(); loadActiveSessions(); loadSessionHistory(); }
        });
    });
    
    // Buscar mensajes
    document.getElementById('search-messages').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') loadMessages();
    });
    
    // Paginación
    document.getElementById('prev-page').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            loadMessages();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', function() {
        const totalPages = Math.ceil(totalMessages / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            loadMessages();
        }
    });
    
    // Probar respuesta
    document.getElementById('test-response-btn').addEventListener('click', testResponse);
    
    // Nota: los export handlers se definen inline en index.html
}

// ==================== FUNCIONES PRINCIPALES ====================

// Cargar dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        // Actualizar estadísticas
        document.getElementById('total-messages').textContent = data.total_messages || 0;
        document.getElementById('today-messages').textContent = data.today_messages || 0;
        document.getElementById('active-responses').textContent = data.response_stats?.length || 0;
        document.getElementById('message-count').textContent = data.total_messages || 0;
        document.getElementById('response-count').textContent = data.response_stats?.length || 0;
        
        // Calcular tasa de respuesta
        const responseRate = data.response_stats?.length > 0 ? 
            Math.round(data.response_stats[0].success_rate || 0) : 0;
        document.getElementById('response-rate').textContent = responseRate + '%';
        
        // Actualizar gráfico de intenciones
        updateIntentChart(data.intent_distribution);
        
        // Actualizar top remitentes
        updateTopSenders(data.top_senders);
        
        // Cargar mensajes recientes
        loadRecentMessages();
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        showAlert('Error cargando dashboard', 'danger');
    }
}

// Cargar mensajes
async function loadMessages() {
    try {
        const search = document.getElementById('search-messages').value;
        const intent = document.getElementById('filter-intent').value;
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        
        const offset = (currentPage - 1) * pageSize;
        
        let url = `/api/messages?limit=${pageSize}&offset=${offset}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (intent) url += `&intent=${intent}`;
        if (dateFrom) url += `&date_from=${dateFrom}`;
        if (dateTo) url += `&date_to=${dateTo}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        totalMessages = data.pagination?.total || 0;

        // Actualizar tabla
        const tbody = document.getElementById('messages-body');
        tbody.innerHTML = '';

        (data.messages || []).forEach(msg => {
            const row = document.createElement('tr');
            const date = new Date(msg.timestamp).toLocaleString('es-CO');
            const intentClass = `intent-${msg.intent || 'no_identificado'}`;
            
            row.innerHTML = `
                <td>${date}</td>
                <td><strong>${msg.from_number}</strong></td>
                <td>${escapeHtml(msg.text || '')}</td>
                <td>
                    <span class="intent-badge ${intentClass}">
                        ${getIntentLabel(msg.intent)}
                    </span>
                </td>
                <td>${escapeHtml(msg.response_sent?.substring(0, 50) || '')}${msg.response_sent?.length > 50 ? '...' : ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewMessage(${msg.id})">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="resendResponse(${msg.id})">
                        <i class="bi bi-reply"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Actualizar paginación
        updatePagination();
        
        // Actualizar contadores
        document.getElementById('messages-showing').textContent = data.messages.length;
        document.getElementById('messages-total').textContent = totalMessages;
        
    } catch (error) {
        console.error('Error cargando mensajes:', error);
        showAlert('Error cargando mensajes', 'danger');
    }
}

// Cargar respuestas
async function loadResponses() {
    try {
        const response = await fetch('/api/responses');
        const responses = await response.json();
        
        const container = document.getElementById('responses-list');
        container.innerHTML = '';
        
        responses.forEach(resp => {
            const card = document.createElement('div');
            card.className = `response-card ${resp.is_active ? 'active' : 'inactive'}`;
            
            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5>${escapeHtml(resp.name)} 
                            <span class="badge ${resp.is_active ? 'bg-success' : 'bg-secondary'}">
                                ${resp.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                            <span class="badge bg-primary">Prioridad: ${resp.priority}</span>
                        </h5>
                        <p class="text-muted mb-1">
                            <strong>Intención:</strong> ${getIntentLabel(resp.intent)}
                        </p>
                        <p class="text-muted mb-1">
                            <strong>Palabras clave:</strong> ${resp.trigger_words || '(ninguna)'}
                        </p>
                        <div class="mt-2 p-2 bg-light rounded">
                            <strong>Respuesta:</strong><br>
                            ${escapeHtml(resp.response_text)}
                        </div>
                        <div class="mt-2 text-muted small">
                            Usada: ${resp.use_count || 0} veces | 
                            Éxito: ${Math.round(resp.success_rate || 0)}%
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="editResponse(${resp.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-${resp.is_active ? 'warning' : 'success'}" 
                                onclick="toggleResponse(${resp.id}, ${resp.is_active})">
                            <i class="bi bi-power"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteResponse(${resp.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error cargando respuestas:', error);
        showAlert('Error cargando respuestas', 'danger');
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        // Actualizar métricas detalladas
        const metricsContainer = document.getElementById('detailed-metrics');
        metricsContainer.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Métrica</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total de mensajes</td>
                        <td>${data.total_messages || 0}</td>
                    </tr>
                    <tr>
                        <td>Mensajes hoy</td>
                        <td>${data.today_messages || 0}</td>
                    </tr>
                    <tr>
                        <td>Respuestas configuradas</td>
                        <td>${data.response_stats?.length || 0}</td>
                    </tr>
                    <tr>
                        <td>Tasa de respuesta promedio</td>
                        <td>${Math.round(data.response_stats?.[0]?.success_rate || 0)}%</td>
                    </tr>
                    <tr>
                        <td>Remitente más activo</td>
                        <td>${data.top_senders?.[0]?.from_number || 'N/A'} (${data.top_senders?.[0]?.message_count || 0} mensajes)</td>
                    </tr>
                </tbody>
            </table>
        `;
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        showAlert('Error cargando estadísticas', 'danger');
    }
}

// Cargar mensajes recientes
async function loadRecentMessages() {
    try {
        const response = await fetch('/api/messages?limit=5');
        const data = await response.json();
        
        const container = document.getElementById('recent-messages');
        container.innerHTML = '';
        
        data.messages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'message-item';
            
            const date = new Date(msg.timestamp).toLocaleString('es-CO');
            const intentClass = `intent-${msg.intent || 'no_identificado'}`;
            
            item.innerHTML = `
                <div class="d-flex justify-content-between">
                    <div>
                        <strong>${msg.from_number}</strong>
                        <span class="intent-badge ${intentClass}">
                            ${getIntentLabel(msg.intent)}
                        </span>
                    </div>
                    <small class="text-muted">${date}</small>
                </div>
                <div class="mt-2">
                    <strong>Mensaje:</strong> ${escapeHtml(msg.text || '')}
                </div>
                ${msg.response_sent ? `
                <div class="mt-1">
                    <strong>Respuesta:</strong> ${escapeHtml(msg.response_sent.substring(0, 100))}${msg.response_sent.length > 100 ? '...' : ''}
                </div>
                ` : ''}
            `;
            
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error cargando mensajes recientes:', error);
    }
}

// ==================== FUNCIONES DE UTILIDAD ====================

// Probar respuesta
async function testResponse() {
    const message = document.getElementById('test-message').value.trim();
    if (!message) {
        showAlert('Por favor escribe un mensaje para probar', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/test-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('test-result');
        resultDiv.innerHTML = `
            <div class="alert alert-info">
                <h5>Resultado de la prueba:</h5>
                <p><strong>Mensaje:</strong> "${escapeHtml(message)}"</p>
                <p><strong>Intención detectada:</strong> ${getIntentLabel(data.intent)}</p>
                <p><strong>Respuesta sugerida:</strong></p>
                <div class="p-3 bg-light rounded">
                    ${escapeHtml(data.suggested_response)}
                </div>
                <p class="mt-2"><strong>Regla aplicada:</strong> ${escapeHtml(data.matched_response?.name || 'N/A')}</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error probando respuesta:', error);
        showAlert('Error probando respuesta', 'danger');
    }
}

// Limpiar filtros
function clearFilters() {
    document.getElementById('search-messages').value = '';
    document.getElementById('filter-intent').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    currentPage = 1;
    loadMessages();
}

// Actualizar paginación
function updatePagination() {
    const totalPages = Math.ceil(totalMessages / pageSize);
    
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    document.getElementById('current-page').textContent = currentPage;
}

// Actualizar gráfico de intenciones
function updateIntentChart(intentData) {
    const container = document.getElementById('intent-chart');
    if (!intentData || intentData.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay datos suficientes</p>';
        return;
    }
    
    let html = '<div class="row">';
    intentData.forEach(item => {
        const percentage = totalMessages > 0 ? Math.round((item.count / totalMessages) * 100) : 0;
        const intentClass = `intent-${item.intent || 'no_identificado'}`;
        
        html += `
            <div class="col-6 mb-2">
                <div class="d-flex justify-content-between">
                    <span>${getIntentLabel(item.intent)}</span>
                    <span>${item.count} (${percentage}%)</span>
                </div>
                <div class="progress" style="height: 10px;">
                    <div class="progress-bar ${intentClass}" 
                         role="progressbar" 
                         style="width: ${percentage}%">
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// Actualizar top remitentes
function updateTopSenders(senders) {
    const container = document.getElementById('top-senders');
    if (!senders || senders.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay datos suficientes</p>';
        return;
    }
    
    let html = '';
    senders.forEach((sender, index) => {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                <div>
                    <span class="badge bg-secondary me-2">${index + 1}</span>
                    ${sender.from_number}
                </div>
                <span class="badge bg-primary">${sender.message_count} mensajes</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Obtener etiqueta legible para intención
function getIntentLabel(intent) {
    const labels = {
        'saludo': 'Saludo',
        'despedida': 'Despedida',
        'bateria': 'Batería',
        'horarios': 'Horarios',
        'ubicacion': 'Ubicación',
        'consulta_estado': 'Consulta Estado',
        'consulta_precio': 'Consulta Precio',
        'servicios': 'Servicios',
        'consulta': 'Consulta General',
        'reparacion': 'Reparación',
        'garantia': 'Garantía',
        'no_identificado': 'No Identificado'
    };
    return labels[intent] || intent || 'Desconocido';
}

// Mostrar alerta
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Crear contenedor de alertas si no existe
    let alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alert-container';
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '20px';
        alertContainer.style.right = '20px';
        alertContainer.style.zIndex = '9999';
        alertContainer.style.maxWidth = '400px';
        document.body.appendChild(alertContainer);
    }

    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Descargar datos como JSON
function downloadJSON(data, name) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Actualizar hora
function updateTime() {
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        timeEl.textContent = new Date().toLocaleString('es-CO');
    }
}

// ==================== ENTRENAMIENTO IA ====================

// Cargar panel de entrenamiento
async function loadTrainingPanel() {
    loadTrainingCoverage();
    loadTrainingSummary();
}

// Probar mensaje y mostrar resultado con opcion de crear respuesta
async function trainTest() {
    const message = document.getElementById('train-message').value.trim();
    if (!message) return;

    try {
        const response = await fetch('/api/test-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json();

        const resultDiv = document.getElementById('train-result');

        if (data.matched_response) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <strong>Respuesta encontrada:</strong> ${escapeHtml(data.matched_response.name)}<br>
                    <strong>Intencion:</strong> ${getIntentLabel(data.intent)}<br>
                    <div class="mt-2 p-2 bg-white rounded">${escapeHtml(data.suggested_response)}</div>
                </div>
            `;
            document.getElementById('quick-add-form').style.display = 'none';
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Sin respuesta configurada</strong><br>
                    No se encontro ninguna respuesta para: "<em>${escapeHtml(message)}</em>"<br>
                    <button class="btn btn-sm btn-success mt-2" onclick="showQuickAdd('${escapeHtml(message).replace(/'/g, "\\'")}')">
                        <i class="bi bi-plus-circle me-1"></i> Crear Respuesta para este mensaje
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error en entrenamiento:', error);
        showAlert('Error probando mensaje', 'danger');
    }
}

// Mostrar formulario rapido con datos pre-llenados
function showQuickAdd(message) {
    const form = document.getElementById('quick-add-form');
    form.style.display = 'block';

    // Extraer palabras clave del mensaje (palabras de 4+ caracteres)
    const words = message.toLowerCase()
        .replace(/[¿?¡!.,]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !['para','como','donde','cuando','cuanto','tengo','tiene','pueden','puedo','quiero','necesito'].includes(w));

    document.getElementById('quick-triggers').value = words.join(',');
    document.getElementById('quick-name').value = '';
    document.getElementById('quick-response').value = '';
    document.getElementById('quick-intent').value = 'consulta';
}

// Guardar respuesta rapida
async function quickAddResponse() {
    const name = document.getElementById('quick-name').value.trim();
    const intent = document.getElementById('quick-intent').value;
    const triggers = document.getElementById('quick-triggers').value.trim();
    const responseText = document.getElementById('quick-response').value.trim();

    if (!name || !triggers || !responseText) {
        showAlert('Completa todos los campos', 'warning');
        return;
    }

    try {
        const resp = await fetch('/api/responses');
        const responses = await resp.json();

        responses.push({
            id: Date.now(),
            name: name,
            intent: intent,
            trigger_words: triggers,
            response_text: responseText,
            is_active: true,
            priority: 1,
            use_count: 0,
            success_rate: 100
        });

        await fetch('/api/save-responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responses })
        });

        document.getElementById('quick-add-form').style.display = 'none';
        showAlert('Respuesta creada exitosamente', 'success');

        // Re-probar el mensaje para confirmar que ahora funciona
        trainTest();
        loadTrainingCoverage();
        loadTrainingSummary();

    } catch (error) {
        console.error('Error guardando respuesta:', error);
        showAlert('Error guardando respuesta', 'danger');
    }
}

// Analizar lote de mensajes
async function batchTrainTest() {
    const text = document.getElementById('batch-messages').value.trim();
    if (!text) return;

    const messages = text.split('\n').map(m => m.trim()).filter(Boolean);
    const resultsDiv = document.getElementById('batch-results');

    resultsDiv.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Analizando...</div>';

    let matched = 0;
    let unmatched = 0;
    let html = '<table class="table table-sm"><thead><tr><th>Mensaje</th><th>Resultado</th><th>Intencion</th><th>Accion</th></tr></thead><tbody>';

    for (const msg of messages) {
        try {
            const response = await fetch('/api/test-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
            const data = await response.json();

            if (data.matched_response) {
                matched++;
                html += `
                    <tr class="table-success">
                        <td>${escapeHtml(msg)}</td>
                        <td><span class="badge bg-success">Cubierto</span></td>
                        <td>${getIntentLabel(data.intent)}</td>
                        <td><small>${escapeHtml(data.matched_response.name)}</small></td>
                    </tr>
                `;
            } else {
                unmatched++;
                html += `
                    <tr class="table-warning">
                        <td>${escapeHtml(msg)}</td>
                        <td><span class="badge bg-warning text-dark">Sin respuesta</span></td>
                        <td>-</td>
                        <td>
                            <button class="btn btn-sm btn-outline-success" onclick="document.getElementById('train-message').value='${escapeHtml(msg).replace(/'/g, "\\'")}'; trainTest(); document.querySelector('[href=\\'#training\\']').click();">
                                <i class="bi bi-plus-circle"></i> Crear
                            </button>
                        </td>
                    </tr>
                `;
            }
        } catch (e) {
            html += `<tr class="table-danger"><td>${escapeHtml(msg)}</td><td colspan="3">Error</td></tr>`;
        }
    }

    html += '</tbody></table>';

    const total = messages.length;
    const coveragePercent = total > 0 ? Math.round((matched / total) * 100) : 0;

    resultsDiv.innerHTML = `
        <div class="alert ${coveragePercent >= 80 ? 'alert-success' : coveragePercent >= 50 ? 'alert-warning' : 'alert-danger'}">
            <strong>Cobertura: ${coveragePercent}%</strong> - ${matched} de ${total} mensajes tienen respuesta (${unmatched} sin cubrir)
        </div>
        ${html}
    `;
}

// Cargar cobertura de respuestas
async function loadTrainingCoverage() {
    try {
        const resp = await fetch('/api/responses');
        const responses = await resp.json();

        const container = document.getElementById('training-coverage');
        const activeResponses = responses.filter(r => r.is_active);

        // Agrupar por intent
        const intents = {};
        activeResponses.forEach(r => {
            if (!intents[r.intent]) intents[r.intent] = [];
            intents[r.intent].push(r);
        });

        let html = '<div class="list-group list-group-flush">';
        for (const [intent, resps] of Object.entries(intents)) {
            const totalTriggers = resps.reduce((sum, r) => sum + (r.trigger_words || '').split(',').filter(Boolean).length, 0);
            html += `
                <div class="list-group-item px-0">
                    <div class="d-flex justify-content-between">
                        <strong>${getIntentLabel(intent)}</strong>
                        <span class="badge bg-primary">${resps.length} resp.</span>
                    </div>
                    <small class="text-muted">${totalTriggers} palabras clave</small>
                </div>
            `;
        }
        html += '</div>';

        container.innerHTML = html;

    } catch (error) {
        console.error('Error cargando cobertura:', error);
    }
}

// Cargar resumen del sistema
async function loadTrainingSummary() {
    try {
        const resp = await fetch('/api/responses');
        const responses = await resp.json();

        const active = responses.filter(r => r.is_active).length;
        const inactive = responses.filter(r => !r.is_active).length;
        const totalTriggers = responses.reduce((sum, r) => sum + (r.trigger_words || '').split(',').filter(Boolean).length, 0);
        const totalUses = responses.reduce((sum, r) => sum + (r.use_count || 0), 0);
        const intents = [...new Set(responses.map(r => r.intent))].length;

        const container = document.getElementById('training-summary');
        container.innerHTML = `
            <div class="row text-center">
                <div class="col">
                    <h3 class="text-primary">${responses.length}</h3>
                    <small class="text-muted">Respuestas Total</small>
                </div>
                <div class="col">
                    <h3 class="text-success">${active}</h3>
                    <small class="text-muted">Activas</small>
                </div>
                <div class="col">
                    <h3 class="text-warning">${inactive}</h3>
                    <small class="text-muted">Inactivas</small>
                </div>
                <div class="col">
                    <h3 class="text-info">${intents}</h3>
                    <small class="text-muted">Intenciones</small>
                </div>
                <div class="col">
                    <h3>${totalTriggers}</h3>
                    <small class="text-muted">Palabras Clave</small>
                </div>
                <div class="col">
                    <h3>${totalUses}</h3>
                    <small class="text-muted">Usos Totales</small>
                </div>
            </div>
            <hr>
            <p class="text-muted small mb-0">
                <strong>Como entrenar:</strong> Escribe mensajes de prueba arriba. Si el bot no responde correctamente,
                crea una nueva respuesta con las palabras clave adecuadas. Usa el entrenamiento por lotes para
                probar multiples mensajes a la vez y detectar huecos en la cobertura.
            </p>
        `;
    } catch (error) {
        console.error('Error cargando resumen:', error);
    }
}

// Enviar prueba real por WhatsApp
async function sendWhatsAppTest() {
    const to = document.getElementById('whatsapp-test-number').value.trim();
    const text = document.getElementById('whatsapp-test-text').value.trim();
    const resultDiv = document.getElementById('whatsapp-test-result');

    if (!to || !text) {
        resultDiv.innerHTML = '<div class="alert alert-warning alert-sm py-1">Completa numero y mensaje</div>';
        return;
    }

    resultDiv.innerHTML = '<div class="text-muted"><div class="spinner-border spinner-border-sm"></div> Enviando...</div>';

    try {
        const response = await fetch('/api/send-test-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, text })
        });
        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = '<div class="alert alert-success py-1">Mensaje enviado. Revisa WhatsApp para ver la respuesta automatica del bot.</div>';
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger py-1">Error: ${escapeHtml(data.error || 'Error desconocido')}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-danger py-1">Error de conexion: ${escapeHtml(error.message)}</div>`;
    }
}

// ==================== CONVERSACIONES ====================

async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        const data = await response.json();

        const container = document.getElementById('conversation-list');
        const searchTerm = (document.getElementById('search-conversations')?.value || '').toLowerCase();

        const filtered = searchTerm
            ? data.conversations.filter(c => c.from_number.includes(searchTerm))
            : data.conversations;

        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-muted text-center mt-4">No hay conversaciones</p>';
            return;
        }

        container.innerHTML = '';
        filtered.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'conversation-item' + (selectedConversation === conv.from_number ? ' active' : '');

            const date = new Date(conv.last_timestamp).toLocaleString('es-CO', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <span class="conv-number">${conv.from_number}</span>
                    <span class="conv-time">${date}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1">
                    <span class="conv-preview">${escapeHtml((conv.last_message || '').substring(0, 40))}</span>
                    <span class="badge bg-primary" style="font-size:.7rem">${conv.message_count}</span>
                </div>
            `;

            item.addEventListener('click', () => openConversation(conv.from_number));
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error cargando conversaciones:', error);
    }
}

async function openConversation(phoneNumber) {
    selectedConversation = phoneNumber;

    // Resaltar item activo
    document.querySelectorAll('.conversation-item').forEach(el => {
        el.classList.toggle('active', el.querySelector('.conv-number')?.textContent === phoneNumber);
    });

    // Mostrar header
    document.getElementById('conversation-header').style.display = 'block';
    document.getElementById('conv-contact-number').textContent = phoneNumber;

    try {
        const response = await fetch('/api/conversations/' + phoneNumber);
        const data = await response.json();

        document.getElementById('conv-message-count').textContent = data.message_count + ' mensajes';

        const threadContainer = document.getElementById('conversation-thread');
        threadContainer.innerHTML = '';

        data.thread.forEach(entry => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.justifyContent = entry.type === 'outgoing' ? 'flex-end' : 'flex-start';

            const time = new Date(entry.timestamp).toLocaleString('es-CO', {
                hour: '2-digit', minute: '2-digit'
            });

            const intentHtml = entry.type === 'incoming' && entry.intent
                ? `<span class="bubble-intent intent-${entry.intent}">${getIntentLabel(entry.intent)}</span>`
                : '';

            const senderLabel = entry.type === 'outgoing'
                ? '<small style="color:#075e54;font-weight:600;">Bot</small><br>'
                : '';

            wrapper.innerHTML = `
                <div class="conv-bubble ${entry.type}">
                    ${senderLabel}${escapeHtml(entry.text)}
                    <div class="bubble-time">${time} ${intentHtml}</div>
                </div>
            `;

            threadContainer.appendChild(wrapper);
        });

        // Scroll al final
        threadContainer.scrollTop = threadContainer.scrollHeight;

    } catch (error) {
        console.error('Error cargando conversacion:', error);
        showAlert('Error cargando conversacion', 'danger');
    }
}

function exportConversation(format) {
    if (!selectedConversation) return;

    if (format === 'txt') {
        window.open('/api/conversations/' + selectedConversation + '/export?format=txt', '_blank');
    } else {
        fetch('/api/conversations/' + selectedConversation + '/export?format=json')
            .then(r => r.json())
            .then(data => downloadJSON(data, 'conversacion_' + selectedConversation))
            .catch(() => showAlert('Error exportando conversacion', 'danger'));
    }
}

// Inicialización adicional
document.addEventListener('DOMContentLoaded', function() {
    const trainInput = document.getElementById('train-message');
    if (trainInput) {
        trainInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') trainTest();
        });
    }

    // Busqueda en conversaciones
    const convSearch = document.getElementById('search-conversations');
    if (convSearch) {
        convSearch.addEventListener('keyup', loadConversations);
    }

    // Auto-refresh conversación activa cada 30s
    setInterval(() => {
        if (selectedConversation) {
            openConversation(selectedConversation);
            loadConversations();
        }
    }, 30000);

    // Poll tunnel status in sidebar dot every 10s
    updateTunnelDot();
    setInterval(updateTunnelDot, 10000);
});

// ==================== NGROK TUNNEL MANAGER ====================

let _tunPollTimer = null;
let _tunStartTime = null;

// Quick sidebar dot update
async function updateTunnelDot() {
    const dot = document.getElementById('tunnel-dot');
    if (!dot) return;
    try {
        const r = await fetch('/api/ngrok/status');
        const d = await r.json();
        dot.style.background = d.running ? '#2ecc71' : '#e74c3c';
    } catch { dot.style.background = '#6c757d'; }
}

// Full tunnel status load
async function loadTunnelStatus() {
    const orb = document.getElementById('tun-orb');
    const statusText = document.getElementById('tun-status-text');
    const urlEl = document.getElementById('tun-url');
    const urlBox = document.getElementById('tun-url-box');
    const copyBtn = document.getElementById('tun-copy-btn');
    const stream = document.getElementById('tun-data-stream');

    orb.className = 'tun-status-orb loading';
    statusText.textContent = 'Verificando...';

    try {
        const r = await fetch('/api/ngrok/status');
        const d = await r.json();

        if (d.running) {
            orb.className = 'tun-status-orb online';
            statusText.innerHTML = '<strong style="color:#2ecc71">ONLINE</strong>';
            urlEl.textContent = d.tunnel.public_url;
            urlBox.style.borderColor = 'rgba(0,255,0,.3)';
            copyBtn.style.display = 'inline-block';
            stream.style.display = 'block';

            document.getElementById('tun-addr').textContent = d.tunnel.addr;
            document.getElementById('tun-proto').textContent = d.tunnel.proto.toUpperCase();
            document.getElementById('tun-pid-badge').textContent = 'PID: ' + (d.pid || '---');

            // Metrics with animation
            animateValue('tun-m-conns', d.metrics.connections);
            animateValue('tun-m-http', d.metrics.http_requests);
            animateValue('tun-m-active', d.metrics.active_connections);
            document.getElementById('tun-m-p50').textContent = d.metrics.p50_latency_ms || '--';
            document.getElementById('tun-m-p90').textContent = d.metrics.p90_latency_ms || '--';

            if (!_tunStartTime) _tunStartTime = Date.now();
            updateUptime();

            // Start live polling
            clearInterval(_tunPollTimer);
            _tunPollTimer = setInterval(loadTunnelStatus, 5000);

        } else {
            orb.className = 'tun-status-orb offline';
            statusText.innerHTML = '<strong style="color:#e74c3c">OFFLINE</strong>';
            urlEl.textContent = 'Sin conexion activa';
            urlBox.style.borderColor = 'rgba(231,76,60,.2)';
            copyBtn.style.display = 'none';
            stream.style.display = 'none';

            document.getElementById('tun-addr').textContent = '---';
            document.getElementById('tun-proto').textContent = '---';
            document.getElementById('tun-pid-badge').textContent = 'PID: ---';
            document.getElementById('tun-uptime').textContent = '---';

            ['tun-m-conns','tun-m-http','tun-m-active'].forEach(id => {
                document.getElementById(id).textContent = '0';
            });
            document.getElementById('tun-m-p50').textContent = '--';
            document.getElementById('tun-m-p90').textContent = '--';

            _tunStartTime = null;
            clearInterval(_tunPollTimer);
            _tunPollTimer = null;
        }

        // Token info
        if (d.authtoken_masked) {
            document.getElementById('tun-token-status').innerHTML =
                '<i class="bi bi-check-circle text-success"></i> Token configurado: <code>' + d.authtoken_masked + '</code>';
        } else {
            document.getElementById('tun-token-status').innerHTML =
                '<i class="bi bi-exclamation-triangle text-warning"></i> Token no configurado';
        }

    } catch (error) {
        orb.className = 'tun-status-orb offline';
        statusText.innerHTML = '<strong style="color:#6c757d">ERROR</strong>';
        urlEl.textContent = 'No se pudo conectar al API';
        clearInterval(_tunPollTimer);
    }
}

// Animate metric values
function animateValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    const current = parseInt(el.textContent) || 0;
    if (current === newValue) return;

    const diff = newValue - current;
    const steps = 15;
    const stepVal = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        el.textContent = Math.round(current + stepVal * step);
        if (step >= steps) {
            el.textContent = newValue;
            clearInterval(timer);
        }
    }, 30);
}

// Update uptime display
function updateUptime() {
    if (!_tunStartTime) return;
    const el = document.getElementById('tun-uptime');
    const diff = Math.floor((Date.now() - _tunStartTime) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    el.textContent = (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
}
setInterval(updateUptime, 1000);

// Execute ngrok action (start, stop, restart, kill)
async function ngrokAction(action) {
    const btn = document.getElementById('btn-tun-' + action);
    const resultDiv = document.getElementById('tun-action-result');
    const port = parseInt(document.getElementById('tun-port').value) || 3000;

    // Disable all buttons and show spinner
    const allBtns = ['start','stop','restart','kill'];
    allBtns.forEach(a => {
        const b = document.getElementById('btn-tun-' + a);
        b.disabled = true;
        if (a === action) {
            b.dataset.originalHtml = b.innerHTML;
            b.innerHTML = '<span class="spinner-border"></span>';
        }
    });

    resultDiv.innerHTML = '<div class="alert alert-info py-2"><div class="spinner-border spinner-border-sm me-2"></div>Ejecutando ' + action + '...</div>';

    try {
        const r = await fetch('/api/ngrok/' + action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port })
        });
        const d = await r.json();

        if (d.error) {
            resultDiv.innerHTML = '<div class="alert alert-warning py-2"><i class="bi bi-exclamation-triangle me-1"></i>' + escapeHtml(d.error) + '</div>';
        } else {
            const msgs = {
                start: 'Tunnel iniciado. Esperando conexion...',
                stop: 'Tunnel detenido correctamente.',
                restart: 'Tunnel reiniciado. Esperando conexion...',
                kill: 'Proceso terminado forzosamente.'
            };
            resultDiv.innerHTML = '<div class="alert alert-success py-2"><i class="bi bi-check-circle me-1"></i>' + msgs[action] + '</div>';

            // Wait and refresh
            if (action === 'start' || action === 'restart') {
                _tunStartTime = Date.now();
                setTimeout(loadTunnelStatus, 4000);
            } else {
                setTimeout(loadTunnelStatus, 1500);
            }
        }
    } catch (error) {
        resultDiv.innerHTML = '<div class="alert alert-danger py-2"><i class="bi bi-x-circle me-1"></i>Error: ' + escapeHtml(error.message) + '</div>';
    }

    // Re-enable buttons
    allBtns.forEach(a => {
        const b = document.getElementById('btn-tun-' + a);
        b.disabled = false;
        if (a === action && b.dataset.originalHtml) {
            b.innerHTML = b.dataset.originalHtml;
        }
    });

    // Clear result after 8s
    setTimeout(() => { resultDiv.innerHTML = ''; }, 8000);
    updateTunnelDot();
}

// Copy tunnel URL
function copyTunnelUrl() {
    const url = document.getElementById('tun-url').textContent;
    if (!url || url === 'Sin conexion activa') return;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('tun-copy-btn');
        btn.innerHTML = '<i class="bi bi-check2"></i>';
        setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 2000);
    });
}

// Toggle token visibility
function toggleTokenVisibility() {
    const input = document.getElementById('tun-authtoken');
    const icon = document.getElementById('tun-eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

// Save auth token
async function saveAuthToken() {
    const authtoken = document.getElementById('tun-authtoken').value.trim();
    if (!authtoken) {
        showAlert('Ingresa un authtoken valido', 'warning');
        return;
    }

    try {
        const r = await fetch('/api/ngrok/authtoken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authtoken })
        });
        const d = await r.json();

        if (d.success) {
            showAlert('Auth token actualizado correctamente', 'success');
            document.getElementById('tun-authtoken').value = '';
            loadTunnelStatus();
        } else {
            showAlert('Error: ' + (d.error || 'Error desconocido'), 'danger');
        }
    } catch (error) {
        showAlert('Error guardando token: ' + error.message, 'danger');
    }
}

// Load ngrok log
async function loadTunnelLog() {
    const logEl = document.getElementById('tun-log');
    try {
        const r = await fetch('/api/ngrok/log');
        const d = await r.json();

        if (d.lines && d.lines.length > 0) {
            logEl.innerHTML = d.lines.map(line => {
                // Color-code log lines
                let color = '#c9d1d9';
                if (line.includes('lvl=eror') || line.includes('ERR') || line.includes('error')) color = '#f85149';
                else if (line.includes('lvl=warn') || line.includes('WARN')) color = '#d29922';
                else if (line.includes('lvl=info') || line.includes('url=')) color = '#58a6ff';
                else if (line.includes('started') || line.includes('online')) color = '#3fb950';
                return '<div style="color:' + color + '">' + escapeHtml(line) + '</div>';
            }).join('');
            logEl.scrollTop = logEl.scrollHeight;
        } else {
            logEl.innerHTML = '<span class="text-muted">No hay log disponible</span>';
        }
    } catch {
        logEl.innerHTML = '<span class="text-muted">Error cargando log</span>';
    }
}
// ==================== IA / OPENCLAW ====================

let wizardState = { step: 1, providers: [], configs: {}, brain: null, prompt: '' };
let aiChatHistory = [];
let _aiDotTimer = null;

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente virtual de Relojería Milla de Oro, una tienda especializada en relojes de lujo y servicios de relojería. Tu rol es atender clientes por WhatsApp de manera amable, profesional y en español.

Puedes ayudar con:
- Consultas sobre servicios (cambio de batería, reparaciones, mantenimiento)
- Información sobre horarios y ubicación
- Preguntas sobre precios y presupuestos
- Seguimiento de reparaciones
- Garantías y políticas de servicio

Sé conciso en tus respuestas (máximo 3-4 líneas). Si no puedes resolver algo, ofrece transferir a un especialista.`;

const PROVIDER_INFO = {
    anthropic: { name: 'Anthropic / Claude', icon: '⚡', models: ['claude-opus-4-6', 'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'] },
    openai:    { name: 'OpenAI', icon: '✨', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'] },
    deepseek:  { name: 'DeepSeek', icon: '🌊', models: ['deepseek-chat', 'deepseek-reasoner'] },
    ollama:    { name: 'Ollama (Local)', icon: '💻', models: [] }
};

// ---- Estado global ----
async function loadAIManagement() {
    try {
        const r = await fetch('/api/ai/config');
        const config = await r.json();
        updateAISidebarDot(config);
        if (config.installed) {
            document.getElementById('ai-wizard').style.display = 'none';
            document.getElementById('ai-control-panel').style.display = 'block';
            renderControlPanel(config);
        } else {
            document.getElementById('ai-wizard').style.display = 'block';
            document.getElementById('ai-control-panel').style.display = 'none';
            // Pre-fill system prompt
            const ta = document.getElementById('wizard-system-prompt');
            if (ta && !ta.value) ta.value = DEFAULT_SYSTEM_PROMPT;
        }
        startAIDotPolling();
    } catch (e) {
        console.error('Error cargando config IA:', e);
    }
}

function updateAISidebarDot(config) {
    const dot = document.getElementById('ai-status-dot');
    if (!dot) return;
    if (config.installed && config.enabled) dot.style.background = '#25D366';
    else if (config.installed) dot.style.background = '#f39c12';
    else dot.style.background = '#6c757d';
}

function startAIDotPolling() {
    if (_aiDotTimer) return;
    _aiDotTimer = setInterval(async () => {
        try {
            const r = await fetch('/api/ai/config');
            updateAISidebarDot(await r.json());
        } catch {}
    }, 30000);
}

// ---- Wizard ----
function toggleProvider(id, el) {
    el.classList.toggle('selected');
    const idx = wizardState.providers.indexOf(id);
    if (idx === -1) wizardState.providers.push(id);
    else wizardState.providers.splice(idx, 1);
}

function wizardNext() {
    const s = wizardState.step;
    if (s === 2 && wizardState.providers.length === 0) {
        showAlert('Selecciona al menos un proveedor', 'warning'); return;
    }
    if (s === 3) {
        if (!collectProviderConfigs()) return;
        buildBrainSelector();
    }
    if (s === 4 && !wizardState.brain) {
        showAlert('Selecciona un cerebro activo', 'warning'); return;
    }
    if (s === 5) {
        wizardState.prompt = document.getElementById('wizard-system-prompt').value.trim();
        if (!wizardState.prompt) { showAlert('Ingresa las instrucciones del agente', 'warning'); return; }
        renderWizardSummary();
    }
    if (s === 6) return;
    goWizardStep(s + 1);
}

function wizardPrev() {
    if (wizardState.step > 1) {
        if (wizardState.step === 3) buildProviderConfigForms(); // rebuild in case needed
        goWizardStep(wizardState.step - 1);
    }
}

function goWizardStep(n) {
    document.getElementById('wizard-step-' + wizardState.step).classList.remove('active');
    document.getElementById('ws-' + wizardState.step).classList.remove('active');
    if (wizardState.step < n) document.getElementById('ws-' + wizardState.step).classList.add('done');

    wizardState.step = n;
    document.getElementById('wizard-step-' + n).classList.add('active');
    const wsEl = document.getElementById('ws-' + n);
    wsEl.classList.remove('pending', 'done');
    wsEl.classList.add('active');

    // Connectors
    for (let i = 1; i <= 5; i++) {
        const c = document.getElementById('wc-' + i);
        if (c) c.classList.toggle('done', i < n);
    }

    // Build step 2 → 3 transition
    if (n === 3) buildProviderConfigForms();
}

function buildProviderConfigForms() {
    const container = document.getElementById('provider-config-forms');
    container.innerHTML = wizardState.providers.map(id => {
        const info = PROVIDER_INFO[id] || { name: id, icon: '🤖', models: [] };
        if (id === 'ollama') return `
            <div class="card mb-3 border-0 bg-light p-3">
                <h6>${info.icon} ${info.name}</h6>
                <p class="text-muted small mb-2">Ollama debe estar corriendo en localhost:11434</p>
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="wizardDetectOllama()">
                    <i class="bi bi-search me-1"></i>Detectar modelos
                </button>
                <div id="ollama-models-list" class="mt-2"></div>
            </div>`;
        return `
            <div class="card mb-3 border-0 bg-light p-3">
                <h6>${info.icon} ${info.name}</h6>
                <div class="row g-2">
                    <div class="col-md-8">
                        <label class="form-label small">API Key</label>
                        <div class="input-group">
                            <input type="password" class="form-control" id="apikey-${id}" placeholder="sk-...">
                            <button class="btn btn-outline-secondary" type="button" onclick="toggleKeyVis('apikey-${id}')"><i class="bi bi-eye"></i></button>
                        </div>
                    </div>
                    <div class="col-md-4 d-flex align-items-end">
                        <button class="btn btn-sm btn-outline-primary w-100" onclick="wizardTestKey('${id}')">
                            <i class="bi bi-wifi me-1"></i>Probar
                        </button>
                    </div>
                </div>
                <div id="test-result-${id}" class="mt-2"></div>
            </div>`;
    }).join('');
}

function toggleKeyVis(inputId) {
    const el = document.getElementById(inputId);
    el.type = el.type === 'password' ? 'text' : 'password';
}

async function wizardTestKey(id) {
    const key = (document.getElementById('apikey-' + id) || {}).value;
    const resultEl = document.getElementById('test-result-' + id);
    if (!key) { resultEl.innerHTML = '<span class="text-warning">Ingresa la API key primero</span>'; return; }
    resultEl.innerHTML = '<span class="text-muted"><i class="bi bi-arrow-repeat spin me-1"></i>Probando...</span>';

    // Temporarily save for test
    const tmpProviders = { [id]: buildProviderObj(id, key, []) };
    try {
        const r = await fetch('/api/ai/providers/' + id + '/test', { method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _tmpTest: true })
        });
        // Real test via install + test flow not needed here — just show key length validity
        if (key.length > 10) {
            resultEl.innerHTML = '<span class="text-success"><i class="bi bi-check-circle me-1"></i>Key ingresada correctamente</span>';
        }
    } catch {}
}

async function wizardDetectOllama() {
    const listEl = document.getElementById('ollama-models-list');
    listEl.innerHTML = '<span class="text-muted">Detectando...</span>';
    try {
        const r = await fetch('/api/ai/ollama/models');
        const d = await r.json();
        if (d.success && d.models.length > 0) {
            listEl.innerHTML = '<p class="text-success small mb-1"><i class="bi bi-check-circle me-1"></i>' + d.models.length + ' modelos encontrados:</p>' +
                d.models.map(m => `<span class="badge bg-secondary me-1 mb-1">${m.name}</span>`).join('');
            if (!wizardState.configs.ollama) wizardState.configs.ollama = { models: d.models.map(m => m.name) };
        } else {
            listEl.innerHTML = '<span class="text-warning">No se detectaron modelos. ¿Ollama está corriendo?</span>' +
                '<div class="mt-2"><select class="form-select form-select-sm" id="ollama-model-select"><option value="qwen2.5:8b">qwen2.5:8b (recomendado)</option><option value="llama3.1:8b">llama3.1:8b</option><option value="mistral:7b">mistral:7b</option></select>' +
                '<button class="btn btn-sm btn-outline-warning mt-1" onclick="wizardPullOllama()"><i class="bi bi-download me-1"></i>Descargar modelo</button></div>';
        }
    } catch (e) {
        listEl.innerHTML = '<span class="text-danger">Error conectando con Ollama: ' + e.message + '</span>';
    }
}

async function wizardPullOllama() {
    const sel = document.getElementById('ollama-model-select');
    if (!sel) return;
    const model = sel.value;
    const listEl = document.getElementById('ollama-models-list');
    listEl.innerHTML += '<br><span class="text-warning"><i class="bi bi-arrow-repeat spin me-1"></i>Descargando ' + model + '... (puede tardar varios minutos)</span>';
    const r = await fetch('/api/ai/ollama/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
    const d = await r.json();
    if (d.success) listEl.innerHTML += '<br><span class="text-success"><i class="bi bi-check-circle me-1"></i>Descarga completada</span>';
    else listEl.innerHTML += '<br><span class="text-danger">Error: ' + d.error + '</span>';
}

function collectProviderConfigs() {
    for (const id of wizardState.providers) {
        if (id === 'ollama') {
            wizardState.configs[id] = { type: 'ollama', baseUrl: 'http://localhost:11434', models: ['qwen2.5:8b', 'llama3.1:8b', 'mistral:7b'] };
            continue;
        }
        const key = (document.getElementById('apikey-' + id) || {}).value || '';
        if (!key) { showAlert('Ingresa la API key para ' + (PROVIDER_INFO[id]?.name || id), 'warning'); return false; }
        wizardState.configs[id] = buildProviderObj(id, key, PROVIDER_INFO[id]?.models || []);
    }
    return true;
}

function buildProviderObj(id, apiKey, models) {
    const info = PROVIDER_INFO[id] || {};
    return {
        id, name: info.name || id,
        type: id === 'anthropic' ? 'anthropic' : id === 'ollama' ? 'ollama' : 'openai-compatible',
        baseUrl: id === 'openai' ? 'https://api.openai.com' : id === 'deepseek' ? 'https://api.deepseek.com' : id === 'ollama' ? 'http://localhost:11434' : 'https://api.anthropic.com',
        apiKey,
        models
    };
}

function buildBrainSelector() {
    const container = document.getElementById('brain-selector-list');
    const options = [];
    wizardState.providers.forEach(id => {
        const info = PROVIDER_INFO[id] || {};
        const models = id === 'ollama'
            ? (wizardState.configs.ollama?.models || ['qwen2.5:8b'])
            : (info.models || []);
        models.forEach(m => {
            options.push({ brain: id + ':' + m, label: (info.icon || '') + ' ' + (info.name || id) + ' — ' + m });
        });
    });
    container.innerHTML = options.map((o, i) => `
        <div class="brain-card ${i === 0 ? 'active-brain' : ''}" onclick="selectBrain('${o.brain}',this)" id="bc-${o.brain.replace(/[^a-z0-9]/g,'_')}">
            <span>${o.label}</span>
            ${i === 0 ? '<span class="badge bg-primary">Seleccionado</span>' : '<span class="badge bg-light text-secondary">Seleccionar</span>'}
        </div>`).join('');
    if (options.length) { wizardState.brain = options[0].brain; }
}

function selectBrain(brain, el) {
    document.querySelectorAll('.brain-card').forEach(c => {
        c.classList.remove('active-brain');
        c.querySelector('.badge').className = 'badge bg-light text-secondary';
        c.querySelector('.badge').textContent = 'Seleccionar';
    });
    el.classList.add('active-brain');
    el.querySelector('.badge').className = 'badge bg-primary';
    el.querySelector('.badge').textContent = 'Seleccionado';
    wizardState.brain = brain;
}

function renderWizardSummary() {
    const container = document.getElementById('wizard-summary');
    const provNames = wizardState.providers.map(id => (PROVIDER_INFO[id]?.icon || '') + ' ' + (PROVIDER_INFO[id]?.name || id)).join(', ');
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-bordered">
                <tr><th class="bg-light">Proveedores</th><td>${provNames}</td></tr>
                <tr><th class="bg-light">Cerebro activo</th><td><strong>${wizardState.brain}</strong></td></tr>
                <tr><th class="bg-light">Prompt</th><td><em>${wizardState.prompt.substring(0, 120)}${wizardState.prompt.length > 120 ? '...' : ''}</em></td></tr>
            </table>
        </div>`;
}

async function wizardInstall() {
    const btn = document.getElementById('btn-wizard-install');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Instalando...';
    try {
        const r = await fetch('/api/ai/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                providers: wizardState.configs,
                activeBrain: wizardState.brain,
                systemPrompt: wizardState.prompt
            })
        });
        const d = await r.json();
        if (d.success) {
            showAlert('✅ IA instalada correctamente. Actívala con el toggle.', 'success');
            setTimeout(() => loadAIManagement(), 500);
        } else {
            throw new Error(d.error || 'Error desconocido');
        }
    } catch (e) {
        showAlert('Error instalando: ' + e.message, 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-cpu me-2"></i>Instalar IA';
    }
}

// ---- Panel de Control ----
function renderControlPanel(config) {
    // Status toggle
    const sw = document.getElementById('ai-toggle-switch');
    const pill = document.getElementById('ai-status-pill');
    const txt = document.getElementById('ai-status-text');
    const lbl = document.getElementById('ai-active-brain-label');
    if (sw) sw.checked = config.enabled;
    if (pill) { pill.classList.toggle('on', config.enabled); pill.classList.toggle('off', !config.enabled); }
    if (txt) txt.textContent = config.enabled ? 'IA Activa' : 'IA Desactivada';
    if (lbl) lbl.textContent = config.activeBrain || '—';

    // System prompt
    const ta = document.getElementById('ai-system-prompt-editor');
    if (ta) ta.value = config.systemPrompt || '';

    // Brain switcher
    renderBrainSwitcher(config);

    // Providers
    renderProvidersList(config);

    // Integrations
    loadIntegrations();

    // Security
    const sri = document.getElementById('sec-require-identity');
    const srl = document.getElementById('sec-rate-limit');
    const scp = document.getElementById('sec-confirm-private');
    if (sri && config.securityRules) sri.checked = !!config.securityRules.requireIdentity;
    if (srl && config.securityRules) srl.value = config.securityRules.rateLimit || 10;
    if (scp && config.securityRules) scp.checked = !!config.securityRules.confirmPrivateData;
}

function renderBrainSwitcher(config) {
    const container = document.getElementById('brain-switcher-list');
    if (!container) return;
    const options = [];
    Object.entries(config.providers || {}).forEach(([pid, provider]) => {
        const info = PROVIDER_INFO[pid] || {};
        const models = provider.models || info.models || [];
        models.forEach(m => {
            const brain = pid + ':' + m;
            options.push({ brain, label: (info.icon || '') + ' ' + (info.name || pid) + ' — ' + m });
        });
        if (!models.length) options.push({ brain: pid + ':default', label: (info.icon || '') + ' ' + (info.name || pid) });
    });
    if (!options.length) { container.innerHTML = '<p class="text-muted">Sin proveedores instalados</p>'; return; }
    container.innerHTML = options.map(o => `
        <div class="brain-card ${config.activeBrain === o.brain ? 'active-brain' : ''}" onclick="switchBrain('${o.brain}')">
            <span>${o.label}</span>
            ${config.activeBrain === o.brain ? '<span class="badge bg-primary">Activo</span>' : '<button class="btn btn-sm btn-outline-secondary">Usar</button>'}
        </div>`).join('');
}

function renderProvidersList(config) {
    const container = document.getElementById('providers-list');
    if (!container) return;
    const entries = Object.entries(config.providers || {});
    if (!entries.length) { container.innerHTML = '<p class="text-muted p-3">Sin proveedores</p>'; return; }
    container.innerHTML = entries.map(([pid, p]) => {
        const info = PROVIDER_INFO[pid] || {};
        return `<div class="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
                <strong>${info.icon || ''} ${info.name || pid}</strong><br>
                <small class="text-muted">${p.apiKey ? p.apiKey.slice(0,6) + '...' + p.apiKey.slice(-4) : 'Ollama local'}</small>
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-info" onclick="testProvider('${pid}')" title="Test">
                    <i class="bi bi-wifi"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="removeProvider('${pid}')" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

async function toggleAI(enabled) {
    try {
        await fetch('/api/ai/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
        const pill = document.getElementById('ai-status-pill');
        const txt = document.getElementById('ai-status-text');
        if (pill) { pill.classList.toggle('on', enabled); pill.classList.toggle('off', !enabled); }
        if (txt) txt.textContent = enabled ? 'IA Activa' : 'IA Desactivada';
        const dot = document.getElementById('ai-status-dot');
        if (dot) dot.style.background = enabled ? '#25D366' : '#f39c12';
    } catch (e) { showAlert('Error: ' + e.message, 'danger'); }
}

async function switchBrain(brain) {
    try {
        const r = await fetch('/api/ai/switch-brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brain }) });
        const d = await r.json();
        if (d.success) {
            document.getElementById('ai-active-brain-label').textContent = brain;
            const r2 = await fetch('/api/ai/config');
            renderBrainSwitcher(await r2.json());
            showAlert('Cerebro cambiado a ' + brain, 'success');
        }
    } catch (e) { showAlert('Error: ' + e.message, 'danger'); }
}

async function saveSystemPrompt() {
    const prompt = document.getElementById('ai-system-prompt-editor').value;
    try {
        await fetch('/api/ai/system-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        showAlert('Instrucciones guardadas', 'success');
    } catch (e) { showAlert('Error: ' + e.message, 'danger'); }
}

async function testProvider(id) {
    showAlert('Probando ' + id + '...', 'info');
    try {
        const r = await fetch('/api/ai/providers/' + id + '/test', { method: 'POST' });
        const d = await r.json();
        if (d.success) showAlert('✅ ' + id + ' OK (' + d.latencyMs + 'ms)', 'success');
        else showAlert('❌ ' + id + ' Error: ' + d.error, 'danger');
    } catch (e) { showAlert('Error: ' + e.message, 'danger'); }
}

async function removeProvider(id) {
    if (!confirm('¿Eliminar proveedor ' + id + '?')) return;
    const r = await fetch('/api/ai/config');
    const config = await r.json();
    delete config.providers[id];
    if (config.activeBrain && config.activeBrain.startsWith(id + ':')) config.activeBrain = null;
    await fetch('/api/ai/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    loadAIManagement();
}

function showAddProviderWizard() {
    showAlert('Recarga la página, entra al wizard y agrega el proveedor', 'info');
}

async function saveSecurityRules() {
    const r = await fetch('/api/ai/config');
    const config = await r.json();
    config.securityRules = {
        requireIdentity: document.getElementById('sec-require-identity').checked,
        rateLimit: parseInt(document.getElementById('sec-rate-limit').value) || 10,
        confirmPrivateData: document.getElementById('sec-confirm-private').checked
    };
    await fetch('/api/ai/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    showAlert('Reglas de seguridad guardadas', 'success');
}

// ---- Chat de Entrenamiento ----
async function sendAIChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    aiChatHistory.push({ role: 'user', content: text });
    renderAIChatMessage('user', text, []);

    const area = document.getElementById('ai-chat-area');
    const loadingId = 'ai-loading-' + Date.now();
    area.innerHTML += `<div id="${loadingId}" style="align-self:flex-start;color:#999;font-size:.85rem;padding:8px">
        <i class="bi bi-three-dots" style="animation:pulse-green 1s infinite"></i> Pensando...
    </div>`;
    area.scrollTop = area.scrollHeight;

    try {
        const r = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: aiChatHistory, context: 'training' })
        });
        const d = await r.json();
        document.getElementById(loadingId)?.remove();

        if (d.reply) {
            aiChatHistory.push({ role: 'assistant', content: d.reply });
            renderAIChatMessage('assistant', d.reply, d.changes || []);
        } else if (d.error) {
            area.innerHTML += `<div style="color:#e74c3c;font-size:.85rem;padding:8px">Error: ${escapeHtml(d.error)}</div>`;
        }
    } catch (e) {
        document.getElementById(loadingId)?.remove();
        area.innerHTML += `<div style="color:#e74c3c;font-size:.85rem;padding:8px">Error de conexión: ${escapeHtml(e.message)}</div>`;
    }
    area.scrollTop = area.scrollHeight;
}

function renderAIChatMessage(role, content, changes) {
    const area = document.getElementById('ai-chat-area');
    const isUser = role === 'user';
    const bubble = document.createElement('div');
    bubble.className = 'conv-bubble ' + (isUser ? 'outgoing' : 'incoming');
    bubble.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    bubble.innerHTML = `<div>${escapeHtml(content)}</div>
        <div class="bubble-time">${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>`;
    area.appendChild(bubble);

    if (changes && changes.length > 0) {
        changes.forEach(ch => {
            const card = document.createElement('div');
            card.className = 'ai-change-card';
            const actionText = ch.action === 'add' ? '✅ Respuesta agregada' : ch.action === 'edit' ? '✏️ Respuesta editada' : '🗑️ Respuesta eliminada';
            card.innerHTML = `<strong>${actionText}:</strong> ${escapeHtml(ch.response?.name || '')}
                ${ch.response?.intent ? '<span class="badge bg-secondary ms-2">' + ch.response.intent + '</span>' : ''}`;
            area.appendChild(card);
        });
    }
    area.scrollTop = area.scrollHeight;
}

// ---- Integraciones ----
async function loadIntegrations() {
    try {
        const r = await fetch('/api/ai/integrations');
        const d = await r.json();
        renderIntegrationsTable(d.integrations || []);
    } catch {}
}

function renderIntegrationsTable(integrations) {
    const tbody = document.getElementById('integrations-table-body');
    if (!tbody) return;
    if (!integrations.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Sin integraciones configuradas</td></tr>';
        return;
    }
    tbody.innerHTML = integrations.map(i => `
        <tr>
            <td class="ps-3"><strong>${escapeHtml(i.name)}</strong><br><small class="text-muted">${escapeHtml(i.description || '')}</small></td>
            <td><code style="font-size:.8rem">${escapeHtml(i.baseUrl)}</code></td>
            <td><span class="badge bg-secondary">${i.authType || 'none'}</span></td>
            <td><span class="badge badge-cat-${i.dataCategory || 'public'}">${i.dataCategory || 'public'}</span></td>
            <td class="text-end pe-3">
                <button class="btn btn-sm btn-outline-danger" onclick="deleteIntegration(${i.id})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`).join('');
}

function toggleIntAuthField() {
    const t = document.getElementById('int-auth-type').value;
    const g = document.getElementById('int-auth-value-group');
    if (g) g.style.display = (t !== 'none') ? 'block' : 'none';
}

async function saveIntegration() {
    const data = {
        id: document.getElementById('int-id').value || null,
        name: document.getElementById('int-name').value,
        baseUrl: document.getElementById('int-url').value,
        authType: document.getElementById('int-auth-type').value,
        authValue: document.getElementById('int-auth-value')?.value || '',
        description: document.getElementById('int-description').value,
        dataCategory: document.getElementById('int-category').value
    };
    if (!data.name || !data.baseUrl) { showAlert('Nombre y URL son requeridos', 'warning'); return; }
    try {
        await fetch('/api/ai/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const modal = bootstrap.Modal.getInstance(document.getElementById('addIntegrationModal'));
        if (modal) modal.hide();
        document.getElementById('int-name').value = '';
        document.getElementById('int-url').value = '';
        document.getElementById('int-description').value = '';
        loadIntegrations();
        showAlert('Integración guardada', 'success');
    } catch (e) { showAlert('Error: ' + e.message, 'danger'); }
}

async function deleteIntegration(id) {
    if (!confirm('¿Eliminar esta integración?')) return;
    try {
        await fetch('/api/ai/integrations/' + id, { method: 'DELETE' });
        loadIntegrations();
    } catch (e) { showAlert('Error: ' + e.message, 'danger'); }
}

// ==================== FOLLOW-UPS EDITOR ====================

let currentFollowUps = [];

function addFollowUpStep() {
    const step = currentFollowUps.length + 1;
    currentFollowUps.push({
        step,
        question: '',
        options: [''],
        trigger_words: '',
        response_map: {},
        default_response: '',
        condition: ''
    });
    renderFollowUpEditor();
}

function removeFollowUpStep(idx) {
    currentFollowUps.splice(idx, 1);
    // Renumerar steps
    currentFollowUps.forEach((f, i) => f.step = i + 1);
    renderFollowUpEditor();
}

function addOptionToStep(stepIdx) {
    currentFollowUps[stepIdx].options.push('');
    renderFollowUpEditor();
}

function removeOptionFromStep(stepIdx, optIdx) {
    const step = currentFollowUps[stepIdx];
    const removed = step.options.splice(optIdx, 1)[0];
    if (removed && step.response_map) delete step.response_map[removed.toLowerCase().trim()];
    renderFollowUpEditor();
}

function renderFollowUpEditor() {
    const container = document.getElementById('follow-ups-container');
    if (!container) return;

    if (!currentFollowUps.length) {
        container.innerHTML = '<div class="text-muted small py-2">Sin follow-ups — la conversación termina con la respuesta inicial.</div>';
        return;
    }

    // Recoger valores actuales del DOM antes de re-renderizar
    collectFollowUps();

    container.innerHTML = currentFollowUps.map((fu, idx) => {
        const prevOptions = idx > 0 ? currentFollowUps[idx - 1].options.filter(o => o.trim()) : [];
        const conditionSelect = idx > 0 ? `
            <div class="col-md-6 mb-2">
                <label class="form-label small">Condición (solo si eligió)</label>
                <select class="form-select form-select-sm" id="fu-condition-${idx}">
                    <option value="">Siempre (sin condición)</option>
                    ${prevOptions.map(o => `<option value="${o.toLowerCase().trim()}" ${fu.condition === o.toLowerCase().trim() ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
            </div>` : '';

        const optionsHtml = (fu.options || ['']).map((opt, oi) => {
            const key = opt.toLowerCase().trim();
            const resp = (fu.response_map && fu.response_map[key]) || '';
            return `<div class="option-row">
                <input type="text" class="form-control form-control-sm" placeholder="Opción" value="${escapeHtml(opt)}" id="fu-opt-${idx}-${oi}">
                <input type="text" class="form-control form-control-sm" placeholder="Respuesta para esta opción" value="${escapeHtml(resp)}" id="fu-resp-${idx}-${oi}">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeOptionFromStep(${idx},${oi})" title="Eliminar opción"><i class="bi bi-x"></i></button>
            </div>`;
        }).join('');

        return `<div class="follow-up-step">
            <button type="button" class="btn btn-sm btn-outline-danger btn-remove-step" onclick="removeFollowUpStep(${idx})"><i class="bi bi-trash"></i></button>
            <div class="d-flex align-items-center gap-2 mb-2">
                <span class="step-number">${idx + 1}</span>
                <strong>Paso ${idx + 1}</strong>
            </div>
            <div class="row">
                ${conditionSelect}
                <div class="col-12 mb-2">
                    <label class="form-label small">Opciones y respuestas</label>
                    ${optionsHtml}
                    <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addOptionToStep(${idx})">
                        <i class="bi bi-plus me-1"></i>Opción
                    </button>
                </div>
                <div class="col-12 mb-2">
                    <label class="form-label small">Respuesta si no entiende</label>
                    <input type="text" class="form-control form-control-sm" id="fu-default-${idx}" value="${escapeHtml(fu.default_response || '')}" placeholder="Ej: No entendí, elige una opción">
                </div>
            </div>
        </div>`;
    }).join('');
}

function collectFollowUps() {
    currentFollowUps.forEach((fu, idx) => {
        // Condition
        const condEl = document.getElementById('fu-condition-' + idx);
        if (condEl) fu.condition = condEl.value;

        // Default response
        const defEl = document.getElementById('fu-default-' + idx);
        if (defEl) fu.default_response = defEl.value;

        // Options and response_map
        const newOptions = [];
        const newResponseMap = {};
        const newTriggers = [];

        let oi = 0;
        while (true) {
            const optEl = document.getElementById('fu-opt-' + idx + '-' + oi);
            const respEl = document.getElementById('fu-resp-' + idx + '-' + oi);
            if (!optEl) break;
            const optVal = optEl.value.trim();
            const respVal = respEl ? respEl.value.trim() : '';
            if (optVal) {
                newOptions.push(optVal);
                const key = optVal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                newResponseMap[key] = respVal;
                newTriggers.push(key);
            }
            oi++;
        }

        fu.options = newOptions.length ? newOptions : [''];
        fu.response_map = newResponseMap;
        fu.trigger_words = newTriggers.join(',');
        fu.question = newOptions.length ? '¿' + newOptions.join(', ') + '?' : '';
    });
}

// ===== Asesores (Advisors) =====

async function loadAdvisors() {
    try {
        const res = await fetch('/api/advisors');
        const { advisors } = await res.json();
        document.getElementById('advisor-count').textContent = advisors.length;
        renderAdvisorsTable(advisors);
    } catch (e) {
        console.error('Error cargando asesores:', e);
        document.getElementById('advisors-table-body').innerHTML =
            '<tr><td colspan="5" class="text-center text-danger py-4">Error cargando asesores</td></tr>';
    }
}

function renderAdvisorsTable(advisors) {
    const tbody = document.getElementById('advisors-table-body');
    if (advisors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Sin asesores registrados</td></tr>';
        return;
    }

    tbody.innerHTML = advisors.map(a => `
        <tr>
            <td class="ps-3"><strong>${a.name}</strong></td>
            <td><code>${a.phone}</code></td>
            <td><small>${(a.roles || []).join(', ') || 'general'}</small></td>
            <td>
                <span class="badge ${a.is_active ? 'bg-success' : 'bg-secondary'}">
                    ${a.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editAdvisor(${a.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAdvisor(${a.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function saveAdvisor() {
    const id = document.getElementById('advisor-edit-id').value;
    const name = document.getElementById('advisor-name').value.trim();
    const phone = document.getElementById('advisor-phone').value.trim();
    const is_active = document.getElementById('advisor-active').checked;

    // Recolectar roles seleccionados
    const roles = ['bateria', 'reparacion', 'joyas', 'ventas', 'general']
        .filter(r => document.getElementById('role-' + r)?.checked);

    if (!name || !phone) {
        alert('Nombre y teléfono son requeridos');
        return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/advisors/${id}` : '/api/advisors';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, roles, is_active })
        });

        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('addAdvisorModal')).hide();
            document.getElementById('advisor-name').value = '';
            document.getElementById('advisor-phone').value = '';
            document.getElementById('advisor-active').checked = true;
            ['bateria', 'reparacion', 'joyas', 'ventas', 'general'].forEach(r => {
                document.getElementById('role-' + r).checked = r === 'general';
            });
            document.getElementById('advisor-edit-id').value = '';
            loadAdvisors();
        } else {
            alert('Error guardando asesor');
        }
    } catch (e) {
        console.error('Error:', e);
        alert('Error: ' + e.message);
    }
}

function editAdvisor(id) {
    fetch('/api/advisors')
        .then(r => r.json())
        .then(({ advisors }) => {
            const advisor = advisors.find(a => a.id === id);
            if (advisor) {
                document.getElementById('advisor-edit-id').value = id;
                document.getElementById('advisor-name').value = advisor.name;
                document.getElementById('advisor-phone').value = advisor.phone;
                document.getElementById('advisor-active').checked = advisor.is_active !== false;
                ['bateria', 'reparacion', 'joyas', 'ventas', 'general'].forEach(r => {
                    document.getElementById('role-' + r).checked = (advisor.roles || []).includes(r);
                });
                new bootstrap.Modal(document.getElementById('addAdvisorModal')).show();
            }
        });
}

async function deleteAdvisor(id) {
    if (!confirm('¿Eliminar este asesor?')) return;
    try {
        const res = await fetch(`/api/advisors/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadAdvisors();
        } else {
            alert('Error eliminando asesor');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

async function loadActiveSessions() {
    try {
        const res = await fetch('/api/sessions/active');
        const { sessions } = await res.json();
        renderActiveSessions(sessions);
    } catch (e) {
        console.error('Error cargando sesiones:', e);
    }
}

function renderActiveSessions(sessions) {
    const tbody = document.getElementById('active-sessions-table-body');
    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Sin sesiones activas</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(s => `
        <tr>
            <td class="ps-3"><strong>${s.advisor_name}</strong></td>
            <td>${s.client_data?.nombre || 'Cliente'}</td>
            <td><small>${s.client_data?.pregunta || '—'}</small></td>
            <td><small>${new Date(s.started_at).toLocaleTimeString()}</small></td>
            <td><small>${new Date(s.last_client_activity).toLocaleTimeString()}</small></td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="forceEndSession('${s.id}')">
                    <i class="bi bi-x-circle"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadSessionHistory() {
    try {
        const res = await fetch('/api/sessions');
        const { sessions } = await res.json();
        const completed = sessions.filter(s => s.status === 'completed');
        renderSessionHistory(completed);
    } catch (e) {
        console.error('Error cargando historial:', e);
    }
}

function renderSessionHistory(sessions) {
    const tbody = document.getElementById('session-history-table-body');
    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Sin sesiones completadas</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(s => `
        <tr>
            <td class="ps-3">${s.advisor_name}</td>
            <td>${s.client_data?.nombre || '—'}</td>
            <td><small>${s.client_data?.pregunta || '—'}</small></td>
            <td><small>${new Date(s.started_at).toLocaleTimeString()}</small></td>
            <td><small>${new Date(s.ended_at).toLocaleTimeString()}</small></td>
            <td><span class="badge ${s.ended_by === 'advisor' ? 'bg-primary' : 'bg-warning'}">${s.ended_by === 'advisor' ? 'Asesor' : s.ended_by === 'timeout' ? 'Timeout' : 'Admin'}</span></td>
        </tr>
    `).join('');
}

async function forceEndSession(sessionId) {
    if (!confirm('¿Terminar esta sesión?')) return;
    try {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        if (res.ok) {
            loadActiveSessions();
            loadSessionHistory();
        } else {
            alert('Error terminando sesión');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

// ==================== SISTEMA ====================

async function loadSystemStatus() {
    try {
        const res = await fetch('/api/system/status');
        const status = await res.json();
        renderSystemCards(status);
        updateSystemBadge(status);
    } catch (e) {
        console.error('Error cargando estado:', e);
        showAlert('Error cargando estado del sistema', 'danger');
    }
}

function renderSystemCards(status) {
    const grid = document.getElementById('services-grid');
    const services = [
        { key: 'middleware', name: 'Middleware Principal', icon: 'bi-hdd', port: 3000 },
        { key: 'webhook', name: 'Webhook Simple', icon: 'bi-link-45deg', port: 5678 },
        { key: 'api', name: 'API Avanzada', icon: 'bi-diagram-3', port: 3004 },
        { key: 'web', name: 'Servidor Web', icon: 'bi-window-dock', port: 3002 },
        { key: 'ngrok', name: 'Ngrok Tunnel', icon: 'bi-globe', port: 4040 }
    ];

    grid.innerHTML = services.map(svc => {
        const st = status[svc.key];
        const isAlive = st?.alive;
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <h6 class="card-title mb-0">
                                <i class="bi ${svc.icon} text-primary me-2"></i>${svc.name}
                            </h6>
                            <div style="width:12px;height:12px;border-radius:50%;background:${isAlive ? '#2ecc71' : '#e74c3c'};animation:${isAlive ? 'pulse-green' : 'none'} 2s infinite;"></div>
                        </div>
                        <p class="small text-muted mb-2">Puerto ${svc.port}</p>
                        ${st?.pid ? `<p class="small"><code>PID: ${st.pid}</code></p>` : '<p class="small text-danger">Sin PID</p>'}

                        <div class="btn-group btn-group-sm w-100 mt-3" role="group">
                            <button class="btn btn-outline-success" onclick="serviceAction('${svc.key}', 'start')">
                                <i class="bi bi-play-fill"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="serviceAction('${svc.key}', 'stop')">
                                <i class="bi bi-stop-fill"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="serviceAction('${svc.key}', 'restart')">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        </div>
                        <button class="btn btn-outline-info btn-sm w-100 mt-2" onclick="showServiceLogs('${svc.key}')">
                            <i class="bi bi-file-text me-1"></i>Ver Logs
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateSystemBadge(status) {
    const active = Object.values(status).filter(s => s?.alive).length;
    const total = Object.keys(status).length;
    const badge = document.getElementById('system-status-badge');
    if (badge) {
        badge.textContent = `${active}/${total}`;
        badge.className = `badge float-end ${active === total ? 'bg-success' : active === 0 ? 'bg-danger' : 'bg-warning'}`;
    }
}

async function serviceAction(service, action) {
    try {
        const endpoint = `/api/system/${service}/${action}`;
        const res = await fetch(endpoint, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            showAlert(`${service}: ${data.message || action}`, 'success');
            setTimeout(loadSystemStatus, 1500);
        } else {
            showAlert(`Error: ${data.error || 'error desconocido'}`, 'danger');
        }
    } catch (e) {
        showAlert(`Error: ${e.message}`, 'danger');
    }
}

async function startAllServices() {
    showAlert('Iniciando todos los servicios...', 'info');
    for (const svc of ['middleware', 'webhook', 'api', 'web']) {
        await serviceAction(svc, 'start');
        await new Promise(r => setTimeout(r, 1000));
    }
    loadSystemStatus();
}

async function stopAllServices() {
    if (!confirm('¿Detener TODOS los servicios?')) return;
    showAlert('Deteniendo todos los servicios...', 'warning');
    for (const svc of ['middleware', 'webhook', 'api', 'web']) {
        await serviceAction(svc, 'stop');
        await new Promise(r => setTimeout(r, 500));
    }
    loadSystemStatus();
}

async function showServiceLogs(service) {
    try {
        const res = await fetch(`/api/system/logs/${service}?lines=50`);
        const { logs } = await res.json();

        // Modal simple para mostrar logs
        const logText = logs.join('\n');
        const modal = `
            <div class="modal fade" id="logsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Logs - ${service}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <textarea class="form-control" rows="12" readonly>${logText}</textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-primary" onclick="copyToClipboard('.form-control')">Copiar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.getElementById('app-modals') || document.body;
        const existing = document.getElementById('logsModal');
        if (existing) existing.remove();

        container.insertAdjacentHTML('beforeend', modal);
        new bootstrap.Modal(document.getElementById('logsModal')).show();
    } catch (e) {
        showAlert(`Error cargando logs: ${e.message}`, 'danger');
    }
}

function copyToClipboard(selector) {
    const text = document.querySelector(selector)?.value || '';
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copiado al portapapeles', 'success');
    });
}

// Polling automático del estado cada 5 segundos cuando está en la pestaña
let systemPollingInterval = null;
document.addEventListener('shown.bs.tab', function(e) {
    if (e.target?.getAttribute('href') === '#system-status') {
        loadSystemStatus();
        if (!systemPollingInterval) {
            systemPollingInterval = setInterval(loadSystemStatus, 5000);
        }
    }
});
document.addEventListener('hidden.bs.tab', function(e) {
    if (e.target?.getAttribute('href') === '#system-status') {
        clearInterval(systemPollingInterval);
        systemPollingInterval = null;
    }
});

// ==================== CONFIGURACIÓN ====================

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();

        const allowedKeys = [
            'M4D_APP_ID', 'M4D_APP_SECRET', 'WA_PHONE_NUMBER_ID', 'WA_BUSINESS_ACCOUNT_ID',
            'CLOUD_API_ACCESS_TOKEN', 'CLOUD_API_VERSION', 'WHATSAPP_BUSINESS_NUMBER',
            'WEBHOOK_ENDPOINT', 'WEBHOOK_VERIFICATION_TOKEN', 'PORT', 'NGROK_AUTH_TOKEN',
            'OPENCLAW_GATEWAY_URL', 'OPENCLAW_API_TOKEN'
        ];

        for (const key of allowedKeys) {
            const inputId = `config-${key}`;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = config[key] || '';
            }
        }
    } catch (e) {
        console.error('Error cargando config:', e);
        showAlert('Error cargando configuración', 'danger');
    }
}

async function saveConfig() {
    try {
        const allowedKeys = [
            'M4D_APP_ID', 'M4D_APP_SECRET', 'WA_PHONE_NUMBER_ID', 'WA_BUSINESS_ACCOUNT_ID',
            'CLOUD_API_ACCESS_TOKEN', 'CLOUD_API_VERSION', 'WHATSAPP_BUSINESS_NUMBER',
            'WEBHOOK_ENDPOINT', 'WEBHOOK_VERIFICATION_TOKEN', 'PORT', 'NGROK_AUTH_TOKEN',
            'OPENCLAW_GATEWAY_URL', 'OPENCLAW_API_TOKEN'
        ];

        const config = {};
        for (const key of allowedKeys) {
            const input = document.getElementById(`config-${key}`);
            if (input) {
                config[key] = input.value;
            }
        }

        const res = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (res.ok) {
            const data = await res.json();
            showAlert(data.message || 'Configuración guardada', 'success');
        } else {
            showAlert('Error guardando configuración', 'danger');
        }
    } catch (e) {
        console.error('Error:', e);
        showAlert(`Error: ${e.message}`, 'danger');
    }
}

function reloadConfig() {
    loadConfig();
    showAlert('Configuración recargada', 'info');
}

function toggleSecret(icon, inputId) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye toggle-secret ms-2';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye-slash toggle-secret ms-2';
    }
}

// Cargar configuración cuando se abre el tab
document.addEventListener('shown.bs.tab', function(e) {
    if (e.target?.getAttribute('href') === '#config') {
        loadConfig();
    }
});
