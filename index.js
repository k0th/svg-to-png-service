const express = require('express');
const https = require('https');
const http = require('http');
const { Resvg } = require('@resvg/resvg-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter (resvg v2) 🚀' });
});

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function resolveExternalImages(svgString) {
  const regex = /href="(https?:\/\/[^"]+)"/g;
  const matches = [];
  let match;
  while ((match = regex.exec(svgString)) !== null) {
    matches.push({ full: match[0], url: match[1] });
  }
  for (const m of matches) {
    try {
      console.log('Descargando:', m.url);
      const buf = await fetchBuffer(m.url);
      const mime = m.url.includes('.jpg') || m.url.includes('.jpeg') ? 'image/jpeg' : 'image/png';
      const b64 = buf.toString('base64');
      svgString = svgString.replace(m.url, 'data:' + mime + ';base64,' + b64);
      console.log('OK - bytes:', buf.length);
    } catch(e) {
      console.log('Error descargando imagen:', e.message);
    }
  }
  return svgString;
}

app.post('/convert/base64', async (req, res) => {
  try {
    const { svg, width = 1000, height = 1250 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'Falta el campo svg' });
    }

    // Intentar decodificar — soporta base64 normal y base64 de URI encoded
    let svgString;
    try {
      const decoded = Buffer.from(svg, 'base64').toString('utf-8');
      // Verificar si es URI encoded
      if (decoded.startsWith('%3C') || decoded.startsWith('%3c')) {
        svgString = decodeURIComponent(decoded);
      } else if (decoded.trimStart().startsWith('<')) {
        svgString = decoded;
      } else {
        // Intentar como URI encoded directo
        try {
          svgString = decodeURIComponent(svg);
        } catch {
          svgString = decoded;
        }
      }
    } catch {
      svgString = svg;
    }

    console.log('SVG inicio:', svgString.substring(0, 80));

    // Resolver imágenes externas
    svgString = await resolveExternalImages(svgString);

    // Convertir con resvg
    const resvg = new Resvg(svgString, {
      fitTo: { mode: 'width', value: width }
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    console.log('PNG generado - bytes:', pngBuffer.length);

    return res.json({
      success: true,
      png_base64: pngBuffer.toString('base64'),
      mime_type: 'image/png',
      filename: 'menu.png'
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
