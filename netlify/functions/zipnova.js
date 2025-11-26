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

    // MODO DE PRUEBA - Simula respuestas
    if (path.includes('/quote')) {
      // Simula cotización
      const basePrice = 1500;
      const weightFactor = body.weight * 200;
      const totalPrice = Math.round(basePrice + weightFactor);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            price: totalPrice,
            estimatedTime: '2-5 días hábiles'
          }
        })
      };
    }

    if (path.includes('/create-shipment')) {
      // Simula creación de envío
      const trackingNumber = 'ZN-TEST-' + Date.now();
      
      // Aquí podrías enviar un email o notificación con los datos
      console.log('NUEVO PEDIDO:', {
        cliente: body.customer,
        direccion: body.address,
        productos: body.items,
        pago: body.payment
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          trackingNumber: trackingNumber,
          message: 'Pedido recibido correctamente (MODO PRUEBA)'
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
