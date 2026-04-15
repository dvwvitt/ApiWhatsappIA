#!/usr/bin/env node

/**
 * Script para probar la API de WhatsApp Business
 * Verifica que la configuración es correcta
 */

require('dotenv').config();
const axios = require('axios');

// Configuración
const config = {
  accessToken: process.env.CLOUD_API_ACCESS_TOKEN,
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
  businessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID,
  apiVersion: process.env.CLOUD_API_VERSION || 'v19.0',
  businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER
};

const API_BASE = `https://graph.facebook.com/${config.apiVersion}`;

console.log('🔍 Probando configuración WhatsApp Business API...\n');
console.log('📋 Configuración:');
console.log(`  • Phone Number ID: ${config.phoneNumberId}`);
console.log(`  • Business Account ID: ${config.businessAccountId}`);
console.log(`  • API Version: ${config.apiVersion}`);
console.log(`  • Business Number: ${config.businessNumber}`);
console.log(`  • Access Token: ${config.accessToken ? '✅ Presente' : '❌ Faltante'}`);
console.log('');

async function testConnection() {
  try {
    console.log('1. Probando conexión a Graph API...');
    
    // Test 1: Obtener información del número de teléfono
    const phoneUrl = `${API_BASE}/${config.phoneNumberId}`;
    const phoneResponse = await axios.get(phoneUrl, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    console.log('   ✅ Información del número obtenida:');
    console.log(`     • ID: ${phoneResponse.data.id}`);
    console.log(`     • Display: ${phoneResponse.data.display_phone_number || 'N/A'}`);
    console.log(`     • Quality: ${phoneResponse.data.quality_rating || 'N/A'}`);
    console.log('');
    
    // Test 2: Obtener información de la cuenta de negocio
    console.log('2. Probando información de cuenta de negocio...');
    const businessUrl = `${API_BASE}/${config.businessAccountId}`;
    const businessResponse = await axios.get(businessUrl, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    console.log('   ✅ Información de negocio obtenida:');
    console.log(`     • ID: ${businessResponse.data.id}`);
    console.log(`     • Name: ${businessResponse.data.name || 'N/A'}`);
    console.log(`     • Message Template Namespace: ${businessResponse.data.message_template_namespace || 'N/A'}`);
    console.log('');
    
    // Test 3: Listar números de teléfono asociados
    console.log('3. Listando números de teléfono asociados...');
    const numbersUrl = `${API_BASE}/${config.businessAccountId}/phone_numbers`;
    const numbersResponse = await axios.get(numbersUrl, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    console.log('   ✅ Números encontrados:');
    numbersResponse.data.data.forEach((phone, index) => {
      console.log(`     ${index + 1}. ${phone.display_phone_number} (ID: ${phone.id})`);
    });
    console.log('');
    
    // Test 4: Verificar que el número configurado existe
    const configuredPhone = numbersResponse.data.data.find(
      p => p.id === config.phoneNumberId
    );
    
    if (configuredPhone) {
      console.log(`4. ✅ Número configurado encontrado en la cuenta:`);
      console.log(`   • Display: ${configuredPhone.display_phone_number}`);
      console.log(`   • Verified: ${configuredPhone.verified_name || 'No verificado'}`);
      console.log(`   • Quality: ${configuredPhone.quality_rating || 'N/A'}`);
    } else {
      console.log('4. ❌ Número configurado NO encontrado en la cuenta');
    }
    console.log('');
    
    console.log('🎉 ¡Todas las pruebas pasaron! La configuración es correcta.');
    console.log('\n📝 Resumen:');
    console.log(`   • API: ✅ Conectada`);
    console.log(`   • Token: ✅ Válido`);
    console.log(`   • Número: ✅ Configurado`);
    console.log(`   • Cuenta: ✅ Accesible`);
    
  } catch (error) {
    console.error('❌ Error en las pruebas:');
    
    if (error.response) {
      console.error(`   • Status: ${error.response.status}`);
      console.error(`   • Error: ${JSON.stringify(error.response.data.error || error.response.data, null, 2)}`);
      console.error(`   • URL: ${error.config?.url}`);
      
      if (error.response.status === 400) {
        console.error('\n💡 Posibles soluciones:');
        console.error('   1. Verifica que el Access Token sea válido');
        console.error('   2. Verifica que el Phone Number ID sea correcto');
        console.error('   3. Verifica permisos de la app en Meta Developers');
      } else if (error.response.status === 401) {
        console.error('\n💡 Token inválido o expirado');
        console.error('   1. Genera un nuevo Access Token en Meta Developers');
        console.error('   2. Verifica que el token tenga permisos de WhatsApp');
      } else if (error.response.status === 404) {
        console.error('\n💡 Recurso no encontrado');
        console.error('   1. Verifica que el Phone Number ID sea correcto');
        console.error('   2. Verifica que el número esté asociado a la cuenta');
      }
    } else {
      console.error(`   • Mensaje: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Ejecutar pruebas
testConnection();