// index.js ─ Plantilla común para todos los micro‑servicios
// ───────────────────────────────────────────────────────
// ▸ Copia este archivo dentro de cada carpeta de servicio
// ▸ Ajusta sólo 2 cosas:
//      1. respuestas (sólo para el log /health)
//      2. La importación de las rutas de ese servicio
//         (p. ej.: const routes = require('./routes/ensayos');)
//
// Si tu servicio **no** necesita rutas públicas, deja PUBLIC_PATHS vacío
// o comenta completamente la verificación de JWT.

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const verify  = require('../_common/middleware/verifyToken');

// 🔄  Ajusta la siguiente línea al archivo de rutas
//     de **este** servicio (ej.: './routes/ensayos')
const routes  = require('./routes/respuestas');

// ───────────── Config genérica ─────────────
const respuestas = process.env.respuestas || 'respuestas-service';
const PORT         = process.env.PORT        || 5006;           // cada contenedor expone su puerto

/**
 *  Rutas públicas (NO exigen JWT) para este micro‑servicio.
 *  Usa el path tal cual lo recibe Express **dentro** del contenedor.
 *  Si montas las rutas con `app.use('/api', routes)`, entonces será
 *  '/api/login' y no '/login'.
 */
const PUBLIC_PATHS = [
  '/health',        // ping de vida
  '/api/login',     // login de usuarios
  '/api/registro'   // registro de usuarios
];

// ───────────── App base ─────────────
const app = express();
app.use(express.json());

// ───────────── Middleware de bypass JWT ─────────────
app.use((req, res, next) => {
  // ¿la ruta solicitada está en la lista de públicas?
  if (PUBLIC_PATHS.includes(req.path)) {
    return next(); // acceso libre
  }
  // para servicios de solo‑respuestas podrías comentar esta línea ↓
  return verify(req, res, next); // exige y verifica JWT
});

// Endpoint de salud (útil para docker‑compose healthcheck)
app.get('/health', (_, res) => res.json({ ok: true, service: respuestas }));

// Rutas de negocio de este micro‑servicio
app.use('/api', routes);

// ───────────── Lanzar servidor ─────────────
app.listen(PORT, () => {
  console.log(`[${respuestas}] escuchando en puerto ${PORT}`);
});
