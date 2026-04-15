# Guia de entrenamiento

Como configurar las respuestas automaticas del sistema.

## Conceptos

- **Intencion**: Lo que el cliente quiere (saludo, bateria, precio, etc.)
- **Palabras clave (trigger words)**: Palabras que activan una respuesta
- **Respuesta**: El mensaje que se envia automaticamente

## Intenciones disponibles

| Intencion | Descripcion | Ejemplos de mensaje |
|-----------|-------------|---------------------|
| `saludo` | Cliente saluda | "Hola", "Buenos dias" |
| `despedida` | Cliente se despide | "Gracias", "Chao" |
| `bateria` | Consulta sobre baterias | "Necesito cambiar bateria" |
| `consulta_estado` | Estado de reparacion | "Como va mi reloj?" |
| `consulta_precio` | Preguntas de precios | "Cuanto cuesta?" |
| `horarios` | Horarios de atencion | "A que hora abren?" |
| `ubicacion` | Donde esta la tienda | "Donde estan ubicados?" |
| `garantia` | Consultas de garantia | "Mi reloj tiene garantia?" |
| `no_identificado` | No se detecta intencion | Cualquier otro mensaje |

## Agregar respuestas

### Via API (recomendado)

```bash
curl -X POST http://localhost:3004/api/save-responses \
  -H "Content-Type: application/json" \
  -d '{
    "responses": [
      {
        "id": 1,
        "name": "Saludo Inicial",
        "intent": "saludo",
        "trigger_words": "hola,buenos dias,buenas tardes,buenas noches",
        "response_text": "Hola! Bienvenido a Relojeria Milla de Oro. En que puedo ayudarte?",
        "is_active": true,
        "priority": 1,
        "use_count": 0,
        "success_rate": 100
      }
    ]
  }'
```

### Via archivo JSON

Edita directamente `data/responses.json`:

```json
[
  {
    "id": 1,
    "name": "Saludo Inicial",
    "intent": "saludo",
    "trigger_words": "hola,buenos dias,buenas tardes",
    "response_text": "Hola! Bienvenido a Relojeria Milla de Oro.",
    "is_active": true,
    "priority": 1
  },
  {
    "id": 2,
    "name": "Horarios",
    "intent": "horarios",
    "trigger_words": "hora,horario,abren,cierran",
    "response_text": "Nuestro horario es de lunes a sabado de 9:00am a 7:00pm.",
    "is_active": true,
    "priority": 2
  }
]
```

## Probar respuestas

Envia un mensaje de prueba al webhook:

```bash
curl -X POST http://localhost:3004/api/analyze-message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola buenos dias"}'
```

La respuesta mostrara la intencion detectada y la respuesta sugerida.

## Respuestas recomendadas para Relojeria

1. **Saludo**: "Hola! Bienvenido a Relojeria Milla de Oro. En que puedo ayudarte?"
2. **Despedida**: "Gracias por contactarnos. Que tengas un excelente dia!"
3. **Horarios**: "Nuestro horario es de lunes a sabado de 9:00am a 7:00pm."
4. **Ubicacion**: "Estamos ubicados en [direccion]. Te esperamos!"
5. **Bateria**: "Te ayudo con el cambio de bateria. Que tipo de reloj es?"
6. **Precio**: "Los precios varian segun el tipo de reloj. Cual es la marca y modelo?"
7. **Estado**: "Consulto el estado de tu reparacion. Dame un momento."
8. **Garantia**: "Nuestras reparaciones tienen garantia. Cuentame que sucede."
9. **No identificado**: "Un especialista te contactara en breve para ayudarte."
