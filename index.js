const express = require('express');
const https = require('https');
const http = require('http');
const { Resvg } = require('@resvg/resvg-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter (resvg) 🚀' });
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
      const mime = m.url.endsWith('.jpg') || m.url.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
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

    // Decodificar base64
    let svgString;
    try {
      const decoded = Buffer.from(svg, 'base64').toString('utf-8');
      svgString = decoded.trimStart().startsWith('<') ? decoded : svg;
    } catch {
      svgString = svg;
    }

    // Resolver imágenes externas
    svgString = await resolveExternalImages(svgString);

    // Convertir con resvg
    const resvg = new Resvg(svgString, {
      fitTo: { mode: 'width', value: width }
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

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
