const express = require('express');
const https = require('https');
const http = require('http');
const { createCanvas, loadImage } = require('canvas');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter (canvas v5) 🚀' });
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

// Parsear atributos de un elemento SVG text
function parseTextElements(svgString) {
  const elements = [];
  const regex = /<text([^>]*)>([^<]*)<\/text>/g;
  let match;
  while ((match = regex.exec(svgString)) !== null) {
    const attrs = match[1];
    const content = match[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const getAttr = (name) => {
      const m = attrs.match(new RegExp(name + '="([^"]*)"'));
      return m ? m[1] : null;
    };

    elements.push({
      x: parseFloat(getAttr('x') || '0'),
      y: parseFloat(getAttr('y') || '0'),
      fontSize: parseFloat(getAttr('font-size') || '16'),
      fontWeight: getAttr('font-weight') || 'normal',
      fill: getAttr('fill') || '#000000',
      textAnchor: getAttr('text-anchor') || 'start',
      letterSpacing: parseFloat(getAttr('letter-spacing') || '0'),
      content: content.trim()
    });
  }
  return elements;
}

// Extraer URL de imagen de fondo
function parseImageUrl(svgString) {
  const m = svgString.match(/href="([^"]+)"/);
  return m ? m[1] : null;
}

// Extraer viewBox/dimensiones
function parseDimensions(svgString) {
  const w = svgString.match(/width="(\d+)"/);
  const h = svgString.match(/height="(\d+)"/);
  return {
    width: w ? parseInt(w[1]) : 1000,
    height: h ? parseInt(h[1]) : 1250
  };
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

    const dims = parseDimensions(svgString);
    const canvasWidth = width || dims.width;
    const canvasHeight = height || dims.height;

    // Crear canvas
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Cargar y dibujar imagen de fondo
    const imgUrl = parseImageUrl(svgString);
    if (imgUrl) {
      try {
        console.log('Cargando imagen:', imgUrl);
        const imgBuf = await fetchBuffer(imgUrl);
        const img = await loadImage(imgBuf);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        console.log('Imagen dibujada OK');
      } catch(e) {
        console.log('Error cargando imagen:', e.message);
      }
    }

    // Dibujar textos
    const textos = parseTextElements(svgString);
    console.log('Textos a renderizar:', textos.length);

    for (const t of textos) {
      if (!t.content) continue;

      ctx.save();
      ctx.font = t.fontWeight + ' ' + t.fontSize + 'px sans-serif';
      ctx.fillStyle = t.fill;

      // Aplicar letter-spacing manualmente
      if (t.letterSpacing && t.letterSpacing > 0) {
        let xPos = t.x;
        const chars = t.content.split('');
        const totalWidth = chars.reduce((acc, ch) => acc + ctx.measureText(ch).width + t.letterSpacing, 0);

        if (t.textAnchor === 'middle') xPos = t.x - totalWidth / 2;
        else if (t.textAnchor === 'end') xPos = t.x - totalWidth;

        for (const ch of chars) {
          ctx.fillText(ch, xPos, t.y);
          xPos += ctx.measureText(ch).width + t.letterSpacing;
        }
      } else {
        ctx.textAlign = t.textAnchor === 'middle' ? 'center' :
                        t.textAnchor === 'end' ? 'right' : 'left';
        ctx.fillText(t.content, t.x, t.y);
      }

      ctx.restore();
    }

    const pngBuffer = canvas.toBuffer('image/png');
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
});
