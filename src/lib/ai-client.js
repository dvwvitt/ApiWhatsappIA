/**
 * AIClient — Cliente unificado para múltiples proveedores de IA
 * Soporta: Anthropic, OpenAI, DeepSeek, Ollama (local)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'ai-config.json');

const PROVIDER_DEFAULTS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic / Claude',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Rápido y eficiente' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Máxima capacidad' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Ultra rápido, económico' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    baseUrl: 'https://api.openai.com',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, rápido' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Económico y eficiente' },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Última generación' }
    ]
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'Chat general' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: 'Razonamiento avanzado' }
    ]
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    models: [
      { id: 'qwen2.5:8b', name: 'Qwen 2.5 8B', description: 'Recomendado para español, ligero' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', description: 'Meta, buen rendimiento general' },
      { id: 'mistral:7b', name: 'Mistral 7B', description: 'Rápido, multilingüe' },
      { id: 'gemma2:9b', name: 'Gemma 2 9B', description: 'Google, equilibrado' }
    ]
  }
};

class AIClient {
  getDefaultConfig() {
    return {
      installed: false,
      enabled: false,
      providers: {},
      activeBrain: null,
      systemPrompt: '',
      integrations: [],
      securityRules: {
        requireIdentity: true,
        rateLimit: 10,
        confirmPrivateData: true
      },
      installedAt: null,
      lastModified: null
    };
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Error leyendo ai-config.json:', e.message);
    }
    return this.getDefaultConfig();
  }

  saveConfig(config) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    config.lastModified = new Date().toISOString();
    const tmpFile = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmpFile, CONFIG_FILE);
  }

  // Parsear "provider:model" → { providerId, modelId }
  _parseBrain(brain) {
    const sepIdx = brain.indexOf(':');
    if (sepIdx === -1) return { providerId: brain, modelId: brain };
    return {
      providerId: brain.substring(0, sepIdx),
      modelId: brain.substring(sepIdx + 1)
    };
  }

  async chat(messages, options = {}) {
    const config = this.loadConfig();
    if (!config.installed || !config.activeBrain) {
      throw new Error('AI no está instalado o no hay cerebro activo');
    }

    const { providerId, modelId } = this._parseBrain(config.activeBrain);
    const provider = config.providers[providerId];
    if (!provider) {
      throw new Error(`Proveedor "${providerId}" no encontrado en la configuración`);
    }

    const systemPrompt = options.systemPrompt || config.systemPrompt || '';
    const timeout = options.timeout || 10000;

    switch (provider.type) {
      case 'anthropic':
        return this._chatAnthropic(modelId, messages, systemPrompt, provider.apiKey, timeout);
      case 'openai-compatible':
        return this._chatOpenAI(modelId, messages, systemPrompt, provider.baseUrl, provider.apiKey, timeout);
      case 'ollama':
        return this._chatOllama(modelId, messages, systemPrompt, provider.baseUrl || 'http://localhost:11434', timeout);
      default:
        throw new Error(`Tipo de proveedor desconocido: ${provider.type}`);
    }
  }

  async _chatAnthropic(model, messages, systemPrompt, apiKey, timeout) {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model,
      max_tokens: 1024,
      system: systemPrompt || undefined,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout
    });

    const content = response.data.content;
    return content.map(c => c.text).join('');
  }

  async _chatOpenAI(model, messages, systemPrompt, baseUrl, apiKey, timeout) {
    const allMessages = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
      model,
      messages: allMessages,
      max_tokens: 1024
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout
    });

    return response.data.choices[0].message.content;
  }

  async _chatOllama(model, messages, systemPrompt, baseUrl, timeout) {
    const allMessages = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

    const response = await axios.post(`${baseUrl}/api/chat`, {
      model,
      messages: allMessages,
      stream: false
    }, { timeout: timeout || 30000 });

    return response.data.message.content;
  }

  async testProvider(providerId) {
    const config = this.loadConfig();
    const provider = config.providers[providerId];
    if (!provider) {
      return { success: false, error: 'Proveedor no encontrado' };
    }

    const start = Date.now();
    try {
      const testMessages = [{ role: 'user', content: 'Responde solo con: OK' }];

      switch (provider.type) {
        case 'anthropic':
          await this._chatAnthropic(
            provider.models?.[0] || 'claude-haiku-4-5-20251001',
            testMessages, '', provider.apiKey, 8000
          );
          break;
        case 'openai-compatible':
          await this._chatOpenAI(
            provider.models?.[0] || 'gpt-4o-mini',
            testMessages, '', provider.baseUrl, provider.apiKey, 8000
          );
          break;
        case 'ollama':
          // Solo verificar que Ollama responde
          await axios.get(`${provider.baseUrl || 'http://localhost:11434'}/api/tags`, { timeout: 5000 });
          break;
      }

      return { success: true, latencyMs: Date.now() - start };
    } catch (e) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: e.response?.data?.error?.message || e.message
      };
    }
  }

  async listOllamaModels() {
    try {
      const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
      return { success: true, models: response.data.models || [] };
    } catch (e) {
      return { success: false, models: [], error: e.message };
    }
  }

  async pullOllamaModel(modelName) {
    try {
      const response = await axios.post('http://localhost:11434/api/pull', {
        name: modelName,
        stream: false
      }, { timeout: 300000 }); // 5 min para descarga
      return { success: true, status: response.data.status };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  getProviderDefaults() {
    return PROVIDER_DEFAULTS;
  }
}

module.exports = AIClient;
