#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1115910294930944';
const API_VERSION = 'v19.0';

async function sendTestMessage() {
    try {
        console.log('📤 Enviando mensaje de prueba a WhatsApp API...');
        
        const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
        
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '573123031988',  // Tu número
            type: 'text',
            text: {
                body: '✅ ¡Prueba exitosa! El sistema WhatsApp Business está funcionando correctamente.'
            }
        };
        
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Mensaje enviado exitosamente!');
        console.log('📱 ID del mensaje:', response.data.messages[0].id);
        console.log('🔗 URL de la API:', url);
        
    } catch (error) {
        console.error('❌ Error enviando mensaje:');
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   Message:', error.message);
        }
    }
}

sendTestMessage();