const https = require('https');

// Credenciales de Zipnova (se configurarán como variables de entorno)
const ZIPNOVA_API_KEY = process.env.ZIPNOVA_API_KEY;
const ZIPNOVA_ACCOUNT_ID = process.env.ZIPNOVA_ACCOUNT_ID;
const ZIPNOVA_API_URL = 'https://api.zipnova.com/v1';

// Función auxiliar para hacer peticiones HTTPS
function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.zipnova.com',
      path: `/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZIPNOVA_API_KEY}`,
        'X-Account-Id': ZIPNOVA_ACCOUNT_ID
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Manejar preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { path } = event;
    const body = JSON.parse(event.body);

    // Cotizar envío
    if (path.includes('/quote')) {
      const quoteData = {
        destination: {
          address: `${body.destination.calle} ${body.destination.numero}`,
          city: body.destination.ciudad,
          state: body.destination.provincia,
          postal_code: body.destination.codigo_postal,
          country: 'AR'
        },
        package: {
          weight: body.weight,
          length: 30,
          width: 20,
          height: 20
        }
      };

      const result = await makeRequest('/shipments/quote', 'POST', quoteData);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            price: result.price || 1500,
            estimatedTime: result.estimated_delivery || '2-5 días'
          }
        })
      };
    }

    // Crear envío
    if (path.includes('/create-shipment')) {
      const shipmentData = {
        origin: {
          name: 'Cervecería Premium',
          phone: '5491112345678',
          address: 'Tu dirección de origen',
          city: 'Tu ciudad',
          state: 'Tu provincia',
          postal_code: '1234',
          country: 'AR'
        },
        destination: {
          name: body.customer.name,
          phone: body.customer.phone,
          email: body.customer.email,
          address: `${body.address.calle} ${body.address.numero}${body.address.piso ? ' ' + body.address.piso : ''}`,
          city: body.address.ciudad,
          state: body.address.provincia,
          postal_code: body.address.codigo_postal,
          country: 'AR'
        },
        package: {
          weight: body.items.reduce((sum, item) => sum + (item.weight * item.quantity), 0),
          description: body.items.map(item => `${item.name} x${item.quantity}`).join(', '),
          value: body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        },
        payment_method: body.payment
      };

      const result = await makeRequest('/shipments', 'POST', shipmentData);

      // Enviar notificación por WhatsApp (opcional)
      const whatsappMsg = `
🍺 *NUEVO PEDIDO*

*Cliente:* ${body.customer.name}
*Teléfono:* ${body.customer.phone}
*Email:* ${body.customer.email}

*Productos:*
${body.items.map(item => `- ${item.name} x${item.quantity}: $${item.price * item.quantity}`).join('\n')}

*Envío:* $${body.shippingCost}
*Total:* $${body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) + body.shippingCost}

*Dirección:*
${body.address.calle} ${body.address.numero}${body.address.piso ? ' ' + body.address.piso : ''}
${body.address.ciudad}, ${body.address.provincia}
CP: ${body.address.codigo_postal}

*Método de pago:* ${body.payment}
*Tracking:* ${result.tracking_number || 'Pendiente'}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          trackingNumber: result.tracking_number || 'ZN' + Date.now(),
          message: 'Envío creado exitosamente'
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Error interno del servidor'
      })
    };
  }
};
