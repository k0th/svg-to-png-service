const express = require('express');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const TMP = '/tmp';

app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SVG to PNG converter running 🚀' });
});

app.post('/convert/base64', async (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  const svgPath = path.join(TMP, `${id}.svg`);
  const pngPath = path.join(TMP, `${id}.png`);

  try {
    const { svg, width = 1000, height = 1250 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'Falta el campo svg' });
    }

    // Decodificar el SVG (puede venir en base64 o texto plano)
    let svgString;
    try {
      const decoded = Buffer.from(svg, 'base64').toString('utf-8');
      svgString = decoded.trimStart().startsWith('<') ? decoded : svg;
    } catch {
      svgString = svg;
    }

    // Guardar SVG en disco
    fs.writeFileSync(svgPath, svgString, 'utf-8');

    // Intentar con sharp primero
    try {
      const sharp = require('sharp');
      const pngBuffer = await sharp(svgPath)
        .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer();

      cleanup(svgPath, pngPath);
      return res.json({
        success: true,
        png_base64: pngBuffer.toString('base64'),
        mime_type: 'image/png',
        filename: 'menu.png'
      });
    } catch (sharpErr) {
      console.log('sharp falló, intentando con Inkscape:', sharpErr.message);
    }

    // Fallback: Inkscape
    try {
      execSync(`inkscape "${svgPath}" --export-type=png --export-filename="${pngPath}" --export-width=${width} --export-height=${height}`, { timeout: 30000 });
      const pngBuffer = fs.readFileSync(pngPath);
      cleanup(svgPath, pngPath);
      return res.json({
        success: true,
        png_base64: pngBuffer.toString('base64'),
        mime_type: 'image/png',
        filename: 'menu.png'
      });
    } catch (inkErr) {
      console.log('Inkscape falló:', inkErr.message);
    }

    // Fallback: rsvg-convert
    try {
      execSync(`rsvg-convert -w ${width} -h ${height} -o "${pngPath}" "${svgPath}"`, { timeout: 30000 });
      const pngBuffer = fs.readFileSync(pngPath);
      cleanup(svgPath, pngPath);
      return res.json({
        success: true,
        png_base64: pngBuffer.toString('base64'),
        mime_type: 'image/png',
        filename: 'menu.png'
      });
    } catch (rsvgErr) {
      console.log('rsvg-convert falló:', rsvgErr.message);
      throw new Error('Ningún convertidor pudo procesar el SVG');
    }

  } catch (err) {
    cleanup(svgPath, pngPath);
    console.error('Error general:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function cleanup(...files) {
  files.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {} });
}

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
