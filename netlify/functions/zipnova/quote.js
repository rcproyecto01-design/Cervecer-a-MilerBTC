exports.handler = async (event, context) => {
  // Manejo de CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Validar destino
    if (!body.destination || !body.destination.address || !body.destination.zipCode) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Falta dirección de destino completa',
          required: ['destination.address', 'destination.zipCode'],
          received: body
        })
      };
    }

    // Origen fijo - Cervecería en La Plata
    const origin = {
      address: "Calle 71 335",
      zipCode: "1900",
      city: "La Plata",
      province: "Buenos Aires",
      country: "Argentina"
    };

    // Preparar payload para ZipNova
    const zipnovaPayload = {
      origin: origin,
      destination: body.destination,
      package: body.package || {
        weight: 5, // kg - peso de caja de cervezas
        dimensions: {
          length: 40,
          width: 30,
          height: 30
        }
      }
    };

    console.log('📦 Cotización:', {
      from: `${origin.city} (${origin.zipCode})`,
      to: `${body.destination.city || 'N/A'} (${body.destination.zipCode})`
    });

    // Llamada a ZipNova API
    const response = await fetch('https://api.zipnova.com/v1/quotes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZIPNOVA_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(zipnovaPayload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ ZipNova error:', responseText);
      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Error al obtener cotización',
          details: responseText,
          status: response.status
        })
      };
    }

    const data = JSON.parse(responseText);
    console.log('✅ Cotización exitosa');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
};
