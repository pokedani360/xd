// index.js ─ Plantilla común para todos los micro‑servicios
// ───────────────────────────────────────────────────────
// ▸ Copia este archivo dentro de cada carpeta de servicio
// ▸ Ajusta sólo 2 cosas:
//        1. preguntas (sólo para el log /health)
//        2. La importación de las rutas de ese servicio
//           (p. ej.: const routes = require('./routes/ensayos');)
//
// Si tu servicio **no** necesita rutas públicas, deja PUBLIC_PATHS vacío
// o comenta completamente la verificación de JWT.

require('dotenv').config();

const express = require('express');
// const cors    = require('cors'); // CORS lo maneja el Gateway (Nginx), así que esta línea no se usa con app.use()
// ¡CAMBIO CLAVE AQUÍ! Ruta de importación correcta para verifyToken
const verify = require('../_common/middleware/verifyToken'); 

// 🔄  Ajusta la siguiente línea al archivo de rutas
//     de **este** servicio (ej.: './routes/ensayos')
const routes  = require('./routes/preguntas'); // Importa el router de preguntas.js

// ───────────── Config genérica ─────────────
const preguntas = process.env.preguntas || 'preguntas-service';
const PORT         = process.env.PORT         || 5002;     // cada contenedor expone su puerto (5002 para preguntas)

/**
 * Rutas públicas (NO exigen JWT) para este micro‑servicio.
 * Aquí solo la ruta /health es pública, ya que la ruta principal / (para listar preguntas)
 * sí requiere token según el frontend (CrearEnsayo.jsx envía el token).
 */
const PUBLIC_PATHS = [
  '/health'    // ping de vida
  // Las rutas /login y /registro pertenecen al servicio de auth, no al de preguntas.
];

// ───────────── App base ─────────────
const app = express();
app.use(express.json());

// Se comenta app.use(cors()) aquí ya que el Gateway (Nginx) es quien maneja CORS
// app.use(cors());

// ───────────── Middleware de bypass JWT ─────────────
app.use((req, res, next) => {
  console.log(`[${preguntas}] Petición entrante: ${req.path}`);
  // ¿la ruta solicitada está en la lista de públicas (tal como la recibe preguntas-service)?
  if (PUBLIC_PATHS.includes(req.path)) {
    console.log(`[${preguntas}] Ruta ${req.path} es pública. Pasando al siguiente middleware/ruta.`);
    return next(); // acceso libre
  }
  // Para este servicio, la ruta de listar preguntas requiere token.
  console.log(`[${preguntas}] Ruta ${req.path} requiere verificación de token.`);
  return verify(req, res, next); // exige y verifica JWT
});

// Endpoint de salud (útil para docker‑compose healthcheck)
app.get('/health', (_, res) => res.json({ ok: true, service: preguntas }));

// Rutas de negocio de este micro‑servicio
// CAMBIO CLAVE: Montar el router en la raíz '/'
// Porque Nginx ya quitó el '/api/preguntas' y envía solo '/'
app.use('/', routes);

// ───────────── Lanzar servidor ─────────────
app.listen(PORT, () => {
  console.log(`[${preguntas}] escuchando en puerto ${PORT}`);
});
