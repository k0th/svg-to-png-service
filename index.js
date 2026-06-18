const express = require('express');
const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

// Descarga una URL y la convierte a base64
function fetchImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      // Seguir redirecciones
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchImageAsBase64(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const mime = res.headers['content-type'] || 'image/png';
        const b64 = Buffer.concat(chunks).toString('base64');
        resolve('data:' + mime + ';base64,' + b64);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Reemplaza todas las URLs externas en el SVG por base64
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
      const dataUrl = await fetchImageAsBase64(m.url);
      svgString = svgString.replace(m.url, dataUrl);
      console.log('Imagen incrustada OK');
    } catch(e) {
      console.log('No se pudo resolver imagen:', m.url, e.message);
    }
  }
  return svgString;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter (Puppeteer) 🚀' });
});

app.post('/convert/base64', async (req, res) => {
  let page;
  try {
    const { svg, width = 1000, height = 1250 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'Falta el campo svg' });
    }

    // Decodificar base64 si es necesario
    let svgString;
    try {
      const decoded = Buffer.from(svg, 'base64').toString('utf-8');
      svgString = decoded.trimStart().startsWith('<') ? decoded : svg;
    } catch {
      svgString = svg;
    }

    // Resolver imágenes externas incrustándolas en base64
    svgString = await resolveExternalImages(svgString);

    // Crear HTML que contiene el SVG
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; background: white; }
  svg { display: block; }
</style>
</head>
<body>${svgString}</body>
</html>`;

    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pngBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });

    await page.close();

    return res.json({
      success: true,
      png_base64: pngBuffer.toString('base64'),
      mime_type: 'image/png',
      filename: 'menu.png'
    });

  } catch (err) {
    if (page) await page.close().catch(() => {});
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
