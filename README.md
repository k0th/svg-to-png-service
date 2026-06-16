# SVG to PNG Microservice

Microservicio Express para convertir SVGs a PNG. Diseñado para usarse con n8n Cloud + Railway.

## Endpoints

### GET /
Health check. Regresa `{ status: "ok" }`.

### POST /convert
Regresa el PNG como archivo binario.

**Body JSON:**
```json
{
  "svg": "<svg>...</svg>",
  "width": 1080,
  "height": 1080
}
```

### POST /convert/base64
Regresa el PNG en base64 (recomendado para n8n).

**Body JSON:**
```json
{
  "svg": "<svg>...</svg>",
  "width": 1080,
  "height": 1080
}
```

**Respuesta:**
```json
{
  "success": true,
  "png_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "filename": "menu.png"
}
```

## Deploy en Railway

1. Sube este código a un repositorio GitHub
2. En Railway: New Project → Deploy from GitHub Repo
3. Selecciona el repositorio
4. Railway detecta automáticamente Node.js y despliega
5. Copia la URL pública generada y úsala en n8n

## Uso en n8n

Nodo HTTP Request:
- Method: POST
- URL: https://tu-servicio.railway.app/convert/base64
- Body: JSON con el campo `svg`
