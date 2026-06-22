const express = require('express');
const https = require('https');
const http = require('http');
const { Resvg } = require('@resvg/resvg-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Cache de fuente para no descargarla cada vez
let fuenteBase64 = null;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter (resvg v4) 🚀' });
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

async function getFuenteBase64() {
  if (fuenteBase64) return fuenteBase64;
  try {
    console.log('Descargando fuente...');
    const buf = await fetchBuffer('https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxK.woff2');
    fuenteBase64 = buf.toString('base64');
    console.log('Fuente descargada OK - bytes:', buf.length);
  } catch(e) {
    console.log('Error descargando fuente:', e.message);
    fuenteBase64 = null;
  }
  return fuenteBase64;
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
      console.log('Descargando imagen:', m.url);
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

function inyectarFuente(svgString, fuenteB64) {
  if (!fuenteB64) return svgString;
  const styleTag = '<defs><style>'
    + '@font-face {'
    + 'font-family: "Roboto";'
    + 'src: url("data:font/woff2;base64,' + fuenteB64 + '") format("woff2");'
    + 'font-weight: normal;'
    + '}'
    + '</style></defs>';
  // Insertar después del tag <svg...>
  return svgString.replace(/(<svg[^>]*>)/, '$1' + styleTag);
}

app.post('/convert/base64', async (req, res) => {
  try {
    const { svg, width = 1000, height = 1250 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'Falta el campo svg' });
    }

    let svgString = Buffer.from(svg, 'base64').toString('utf-8');

    if (!svgString.trimStart().startsWith('<svg') && !svgString.trimStart().startsWith('<SVG')) {
      return res.status(400).json({
        error: 'No es SVG valido. Inicio: ' + JSON.stringify(svgString.substring(0, 80))
      });
    }

    // Resolver imagenes externas
    svgString = await resolveExternalImages(svgString);

    // Inyectar fuente Roboto
    const fuente = await getFuenteBase64();
    svgString = inyectarFuente(svgString, fuente);

    // Reemplazar font-family por Roboto
    svgString = svgString.replace(/font-family="[^"]+"/g, 'font-family="Roboto, sans-serif"');

    console.log('Convirtiendo SVG...');

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
  console.log('Servidor corriendo en puerto ' + PORT);
  // Pre-cargar la fuente al iniciar
  getFuenteBase64();
});
