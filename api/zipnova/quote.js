// Vercel Serverless Function para cotización de envío con ZipNova

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método no permitido',
      allowedMethods: ['POST']
    });
  }

  try {
    const body = req.body;
    
    // Validar destino
    if (!body.destination || !body.destination.address || !body.destination.zipCode) {
      return res.status(400).json({ 
        error: 'Falta dirección de destino completa',
        required: ['destination.address', 'destination.zipCode'],
        received: body
      });
    }

    // Origen fijo - Cervecería en La Plata
    const origin = {
      address: process.env.BREWERY_ADDRESS || "Calle 71 335",
      zipCode: process.env.BREWERY_ZIPCODE || "1900",
      city: process.env.BREWERY_CITY || "La Plata",
      province: process.env.BREWERY_PROVINCE || "Buenos Aires",
      country: "Argentina"
    };

    // Preparar payload para ZipNova
    const zipnovaPayload = {
      origin: origin,
      destination: body.destination,
      package: body.package || {
        weight: 5,
        dimensions: {
          length: 40,
          width: 30,
          height: 30
        }
      }
    };

    console.log('📦 Cotización solicitada:', {
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
      return res.status(response.status).json({ 
        error: 'Error al obtener cotización de ZipNova',
        details: responseText,
        status: response.status
      });
    }

    const data = JSON.parse(responseText);
    console.log('✅ Cotización exitosa');

    return res.status(200).json(data);

  } catch (error) {
    console.error('💥 Error en la función:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message
    });
  }
}
```

**1.5** Click en **"Commit changes..."**
- Mensaje: `Add Vercel serverless function for shipping quotes`
- Click en **"Commit changes"**

---

## PASO 2: Crear vercel.json (Configuración)

**2.1** Click en **"Add file"** → **"Create new file"**

**2.2** En el nombre escribe:
```
vercel.json
{
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
