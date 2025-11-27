const https = require('https');

const ZIPNOVA_API_KEY = process.env.ZIPNOVA_API_KEY;
const ZIPNOVA_ACCOUNT_ID = process.env.ZIPNOVA_ACCOUNT_ID;

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(data);
    
    const options = {
      hostname: 'api.zipnova.com.ar',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': dataString.length,
        'Authorization': `Bearer ${ZIPNOVA_API_KEY}`,
        'X-Account-Id': ZIPNOVA_ACCOUNT_ID
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: { error: 'Invalid JSON', body: body } });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(dataString);
    req.end();
  });
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

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
    const body = JSON.parse(event.body);
    const action = body.action;

    console.log('Action:', action);
    console.log('Body:', JSON.stringify(body, null, 2));

    // COTIZAR ENVÍO
    if (action === 'quote') {
      const quotePayload = {
        origin: {
          address: {
            street: "71",
            number: "355",
            city: "La Plata",
            state: "Buenos Aires",
            zipcode: "1900",
            country: "AR"
          }
        },
        destination: {
          address: {
            street: body.destination.calle,
            number: body.destination.numero,
            floor: body.destination.piso || "",
            city: body.destination.ciudad,
            state: body.destination.provincia,
            zipcode: body.destination.codigo_postal,
            country: "AR"
          }
        },
        packages: [{
          weight: Math.round(body.weight * 1000), // kg a gramos
          height: 20,
          width: 20,
          length: 30
        }]
      };

      console.log('Quote payload:', JSON.stringify(quotePayload, null, 2));

      const result = await makeRequest('/v2/shipments/rates', 'POST', quotePayload);

      console.log('Zipnova response:', result);

      if (result.statusCode === 200 && result.data.rates && result.data.rates.length > 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              price: result.data.rates[0].total_price,
              estimatedTime: result.data.rates[0].estimated_delivery || '3-7 días hábiles',
              carrier: result.data.rates[0].carrier_name
            }
          })
        };
      } else {
        // Si falla la API, usar precio estimado
        console.log('No rates found, using fallback');
        const fallbackPrice = 1500 + (body.weight * 200);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              price: Math.round(fallbackPrice),
              estimatedTime: '3-7 días hábiles',
              carrier: 'Estimado'
            }
          })
        };
      }
    }

    // CREAR ENVÍO
    if (action === 'create-shipment') {
      const shipmentPayload = {
        origin: {
          name: "Cervecería Premium",
          phone: "549234415501539",
          email: "rcproyecto01@gmail.com",
          address: {
            street: "71",
            number: "355",
            city: "La Plata",
            state: "Buenos Aires",
            zipcode: "1900",
            country: "AR"
          }
        },
        destination: {
          name: body.customer.name,
          phone: body.customer.phone,
          email: body.customer.email,
          address: {
            street: body.address.calle,
            number: body.address.numero,
            floor: body.address.piso || "",
            city: body.address.ciudad,
            state: body.address.provincia,
            zipcode: body.address.codigo_postal,
            country: "AR"
          }
        },
        packages: [{
          weight: Math.round(body.items.reduce((sum, item) => sum + (item.weight * item.quantity), 0) * 1000),
          height: 20,
          width: 20,
          length: 30,
          description: body.items.map(item => `${item.name} x${item.quantity}`).join(', ')
        }],
        declared_value: body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        reference: `PEDIDO-${Date.now()}`
      };

      console.log('Shipment payload:', JSON.stringify(shipmentPayload, null, 2));

      const result = await makeRequest('/v2/shipments', 'POST', shipmentPayload);

      console.log('Create shipment response:', result);

      if (result.statusCode === 200 || result.statusCode === 201) {
        // Notificar por WhatsApp
        const whatsappMsg = encodeURIComponent(`
🍺 *NUEVO PEDIDO - CERVECERÍA PREMIUM*

*CLIENTE:*
👤 ${body.customer.name}
📱 ${body.customer.phone}
✉️ ${body.customer.email}

*PRODUCTOS:*
${body.items.map(item => `• ${item.name} x${item.quantity} - $${item.price * item.quantity}`).join('\n')}

*SUBTOTAL:* $${body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
*ENVÍO:* $${body.shippingCost}
*TOTAL:* $${body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) + body.shippingCost}

*DIRECCIÓN DE ENTREGA:*
📍 ${body.address.calle} ${body.address.numero}${body.address.piso ? ' ' + body.address.piso : ''}
🏘️ ${body.address.ciudad}, ${body.address.provincia}
📮 CP: ${body.address.codigo_postal}

*PAGO:* ${body.payment}
*TRACKING:* ${result.data.tracking_code || 'Pendiente'}

🔗 Ver en Zipnova: https://app.zipnova.com
        `);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            trackingNumber: result.data.tracking_code || 'ZN-' + Date.now(),
            message: 'Envío creado exitosamente en Zipnova',
            whatsappLink: `https://wa.me/549234415501539?text=${whatsappMsg}`
          })
        };
      } else {
        throw new Error(`Error de Zipnova: ${JSON.stringify(result.data)}`);
      }
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false,
        message: 'Acción no válida' 
      })
    };

  } catch (error) {
    console.error('Error en la función:', error);
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
