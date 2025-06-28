// index.js ─ Plantilla común para todos los micro‑servicios
// ───────────────────────────────────────────────────────
// ▸ Copia este archivo dentro de cada carpeta de servicio
// ▸ Ajusta sólo 2 cosas:
//       1. materias (sólo para el log /health)
//       2. La importación de las rutas de ese servicio
//          (p. ej.: const routes = require('./routes/ensayos');)
//
// Si tu servicio **no** necesita rutas públicas, deja PUBLIC_PATHS vacío
// o comenta completamente la verificación de JWT.

require('dotenv').config();

const express = require('express');
// const cors    = require('cors'); // CORS lo maneja el Gateway (Nginx), así que esta línea no se usa con app.use()
const verify  = require('../_common/middleware/verifyToken');

// 🔄  Ajusta la siguiente línea al archivo de rutas
//     de **este** servicio (ej.: './routes/ensayos')
const routes  = require('./routes/materias'); // Importa el router de materias.js

// ───────────── Config genérica ─────────────
const materias = process.env.materias || 'materias-service';
const PORT         = process.env.PORT         || 5005;     // cada contenedor expone su puerto (5005 para materias)

/**
 * Rutas públicas (NO exigen JWT) para este micro‑servicio.
 * Aquí solo la ruta /health es pública, ya que la ruta principal / (para listar materias)
 * sí requiere token según el frontend (CrearEnsayo.jsx envía el token).
 */
const PUBLIC_PATHS = [
  '/health'    // ping de vida
  // Las rutas /login y /registro pertenecen al servicio de auth, no al de materias.
];

// ───────────── App base ─────────────
const app = express();
app.use(express.json());

// Se comenta app.use(cors()) aquí ya que el Gateway (Nginx) es quien maneja CORS
// app.use(cors());

// ───────────── Middleware de bypass JWT ─────────────
app.use((req, res, next) => {
  console.log(`[${materias}] Petición entrante: ${req.path}`);
  // ¿la ruta solicitada está en la lista de públicas (tal como la recibe materias-service)?
  if (PUBLIC_PATHS.includes(req.path)) {
    console.log(`[${materias}] Ruta ${req.path} es pública. Pasando al siguiente middleware/ruta.`);
    return next(); // acceso libre
  }
  // Para este servicio, la ruta de listar materias requiere token.
  console.log(`[${materias}] Ruta ${req.path} requiere verificación de token.`);
  return verify(req, res, next); // exige y verifica JWT
});

// Endpoint de salud (útil para docker‑compose healthcheck)
app.get('/health', (_, res) => res.json({ ok: true, service: materias }));

// Rutas de negocio de este micro‑servicio
// CAMBIO CLAVE: Montar el router en la raíz '/'
// Porque Nginx ya quitó el '/api/materias' y envía solo '/'
app.use('/', routes);

// ───────────── Lanzar servidor ─────────────
app.listen(PORT, () => {
  console.log(`[${materias}] escuchando en puerto ${PORT}`);
});
