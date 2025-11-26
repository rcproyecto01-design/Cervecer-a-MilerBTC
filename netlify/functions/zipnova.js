const https = require('https');

const ZIPNOVA_API_KEY = process.env.ZIPNOVA_API_KEY;
const ZIPNOVA_ACCOUNT_ID = process.env.ZIPNOVA_ACCOUNT_ID;

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.zipnova.com.ar',
      path: `/v2${path}`,
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
          resolve({ error: 'Invalid JSON response', body: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
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
    const { path } = event;
    const body = JSON.parse(event.body);

    if (path.includes('/quote')) {
      const quoteData = {
        account_id: ZIPNOVA_ACCOUNT_ID,
        destination: {
          name: "Cliente",
          street: body.destination.calle,
          street_number: body.destination.numero,
          street_extras: body.destination.piso || "",
          city: body.destination.ciudad,
          state: body.destination.provincia,
          zipcode: body.destination.codigo_postal,
          country: "AR"
        },
        packages: [{
          weight: body.weight * 1000,
          height: 20,
          width: 20,
          length: 30
        }]
      };

      const result = await makeRequest('/shipments/rates', 'POST', quoteData);

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            price: result.rates?.[0]?.price || 1500,
            estimatedTime: '2-5 días'
          }
        })
      };
    }

    if (path.includes('/create-shipment')) {
      const shipmentData = {
        account_id: ZIPNOVA_ACCOUNT_ID,
        origin: {
          name: 'Cervecería Premium',
          phone: '5491112345678',
          street: 'Tu calle',
          street_number: '123',
          city: 'Tu ciudad',
          state: 'Tu provincia',
          zipcode: '1234',
          country: 'AR'
        },
        destination: {
          name: body.customer.name,
          phone: body.customer.phone,
          email: body.customer.email,
          street: body.address.calle,
          street_number: body.address.numero,
          street_extras: body.address.piso || '',
          city: body.address.ciudad,
          state: body.address.provincia,
          zipcode: body.address.codigo_postal,
          country: 'AR'
        },
        packages: [{
          weight: body.items.reduce((sum, item) => sum + (item.weight * item.quantity * 1000), 0),
          height: 20,
          width: 20,
          length: 30,
          description: body.items.map(item => `${item.name} x${item.quantity}`).join(', ')
        }],
        declared_value: body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      };

      const result = await makeRequest('/shipments', 'POST', shipmentData);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          trackingNumber: result.tracking_code || 'ZN' + Date.now(),
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
