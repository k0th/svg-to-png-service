const express = require('express');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Aumentar límite para SVGs grandes
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'image/svg+xml', limit: '10mb' }));

// ─── Health check ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter running 🚀' });
});

// ─── Conversión SVG → PNG ─────────────────────────────────────
// Acepta el SVG como texto en el body JSON: { "svg": "<svg>...</svg>", "width": 1080, "height": 1080 }
app.post('/convert', async (req, res) => {
  try {
    let svgContent;
    const { svg, width = 1080, height = 1080 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'Falta el campo "svg" en el body' });
    }

    // Soporte para SVG en base64 o texto plano
    if (svg.startsWith('data:image/svg+xml;base64,')) {
      svgContent = Buffer.from(svg.split(',')[1], 'base64');
    } else if (isBase64(svg)) {
      svgContent = Buffer.from(svg, 'base64');
    } else {
      svgContent = Buffer.from(svg, 'utf-8');
    }

    const pngBuffer = await sharp(svgContent)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'attachment; filename="menu.png"');
    res.send(pngBuffer);

  } catch (err) {
    console.error('Error convirtiendo SVG:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Conversión y regresa base64 ─────────────────────────────
// Útil para n8n que maneja base64 fácilmente
app.post('/convert/base64', async (req, res) => {
  try {
    const { svg, width = 1080, height = 1080 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'Falta el campo "svg" en el body' });
    }

    let svgContent;
    if (svg.startsWith('data:image/svg+xml;base64,')) {
      svgContent = Buffer.from(svg.split(',')[1], 'base64');
    } else if (isBase64(svg)) {
      svgContent = Buffer.from(svg, 'base64');
    } else {
      svgContent = Buffer.from(svg, 'utf-8');
    }

    const pngBuffer = await sharp(svgContent)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    res.json({
      success: true,
      png_base64: pngBuffer.toString('base64'),
      mime_type: 'image/png',
      filename: 'menu.png'
    });

  } catch (err) {
    console.error('Error convirtiendo SVG:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────
function isBase64(str) {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
}

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
