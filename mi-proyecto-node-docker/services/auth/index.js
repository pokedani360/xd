// index.js ─ Plantilla común para todos los micro‑servicios
// ───────────────────────────────────────────────────────
// ▸ Copia este archivo dentro de cada carpeta de servicio
// ▸ Ajusta sólo 2 cosas:
//       1. auth (sólo para el log /health)
//       2. La importación de las rutas de ese servicio
//          (p. ej.: const routes = require('./routes/ensayos');)
//
// Si tu servicio **no** necesita rutas públicas, deja PUBLIC_PATHS vacío
// o comenta completamente la verificación de JWT.

require('dotenv').config();

const express = require('express');
const cors    = require('cors'); // Se mantiene si se usa en otros servicios, pero se asegura que no se use con app.use()
const verify  = require('../_common/middleware/verifyToken');

// 🔄  Ajusta la siguiente línea al archivo de rutas
//     de **este** servicio (ej.: './routes/ensayos')
const routes  = require('./routes/auth'); // Importa el router de auth.js

// ───────────── Config genérica ─────────────
const auth = process.env.auth || 'auth-service';
const PORT         = process.env.PORT         || 5001;     // cada contenedor expone su puerto

/**
 * Rutas públicas (NO exigen JWT) para este micro‑servicio.
 * Ahora usan el path tal cual lo recibe Express DESPUÉS de que Nginx
 * haya quitado el prefijo /api/auth.
 */
const PUBLIC_PATHS = [
  '/health',    // ping de vida
  '/login',     // login de usuarios (sin prefijo /api/auth)
  '/registro'   // registro de usuarios (sin prefijo /api/auth)
];

// ───────────── App base ─────────────
const app = express();
app.use(express.json());

// Se comenta app.use(cors()) aquí ya que el Gateway (Nginx) es quien maneja CORS
// app.use(cors());

// ───────────── Middleware de bypass JWT ─────────────
app.use((req, res, next) => {
  console.log(`Petición entrante: ${req.path}`);
  // ¿la ruta solicitada está en la lista de públicas (tal como la recibe auth-service)?
  if (PUBLIC_PATHS.includes(req.path)) {
    console.log(`Ruta ${req.path} es pública. Pasando al siguiente middleware/ruta.`);
    return next(); // acceso libre
  }
  // para servicios de solo‑auth podrías comentar esta línea ↓
  console.log(`Ruta ${req.path} requiere verificación de token.`);
  return verify(req, res, next); // exige y verifica JWT
});

// Endpoint de salud (útil para docker‑compose healthcheck)
app.get('/health', (_, res) => res.json({ ok: true, service: auth }));

// Rutas de negocio de este micro‑servicio
// CAMBIO CLAVE: Montar el router en la raíz '/'
// Porque Nginx ya quitó el '/api/auth'
app.use('/', routes);

// ───────────── Lanzar servidor ─────────────
app.listen(PORT, () => {
  console.log(`[${auth}] escuchando en puerto ${PORT}`);
});
