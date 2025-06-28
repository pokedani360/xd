// index.js ─ Plantilla común para todos los micro‑servicios
// ───────────────────────────────────────────────────────
// ▸ Copia este archivo dentro de cada carpeta de servicio
// ▸ Ajusta sólo 2 cosas:
//       1. resultados (sólo para el log /health)
//       2. La importación de las rutas de ese servicio
//          (p. ej.: const routes = require('./routes/ensayos');)
//
// Si tu servicio **no** necesita rutas públicas, deja PUBLIC_PATHS vacío
// o comenta completamente la verificación de JWT.

require('dotenv').config();

const express = require('express');
// const cors    = require('cors'); // CORS lo maneja el Gateway (Nginx), así que esta línea no se usa con app.use()
// ¡CORRECCIÓN CLAVE AQUÍ! Importar verificarToken directamente del archivo verifyToken.js
const verificarToken = require('../_common/middleware/verifyToken'); // Ruta correcta para acceder a verifyToken.js

let routes; // Declarar 'routes' fuera del try-catch

try {
  // 🔄  Ajusta la próxima línea para el archivo de rutas
  //     de **este** servicio (ej.: './routes/ensayos')
  routes = require('./routes/resultados'); // Importa el router de resultados.js
  console.log(`[resultados-service] Rutas de resultados importadas con éxito.`);
} catch (err) {
  console.error(`💥 [resultados-service] Error al importar './routes/resultados':`, err.message);
  // Si la importación falla, el servicio no podrá manejar las rutas.
  // Es crítico que este error sea visible.
  process.exit(1); // Forzar la salida del proceso con un código de error
}


// ───────────── Configuración genérica ─────────────
const resultados = process.env.resultados || 'resultados-service';
const PORT         = process.env.PORT         || 5004;     // cada contenedor expone su puerto (5004 para resultados)

/**
 * Rutas públicas (NO exigen JWT) para este micro‑servicio.
 * Aquí, solo la ruta /health es pública, ya que todas las rutas de resultados
 * (crear-resultado, responder, finalizar, etc.) exigen autenticación.
 */
const PUBLIC_PATHS = [
  '/health'    // ping de vida
];

// ───────────── App base ─────────────
const app = express();
app.use(express.json());

// Se comenta app.use(cors()) aquí ya que el Gateway (Nginx) es quien maneja CORS
// app.use(cors());

// ───────────── Middleware de bypass JWT ─────────────
app.use((req, res, next) => {
  console.log(`[${resultados}] Petición entrante: ${req.path}`);
  // ¿La ruta solicitada está en la lista de rutas públicas (tal como es recibida por el resultados-service)?
  if (PUBLIC_PATHS.includes(req.path)) {
    console.log(`[${resultados}] Ruta ${req.path} es pública. Pasando al siguiente middleware/ruta.`);
    return next(); // acceso libre
  }
  // Para este servicio, todas las rutas de negocio exigen token.
  console.log(`[${resultados}] Ruta ${req.path} exige verificación de token.`);
  // ¡CORRECCIÓN CLAVE AQUÍ! Usar verificarToken directamente
  return verificarToken(req, res, next); // exige y verifica JWT
});

// Punto de conexión de salud (útil para docker‑compose healthcheck)
app.get('/health', (_, res) => res.json({ ok: true, service: resultados }));

// REGISTRO CRÍTICO: Verifica qué tipo de objeto es 'routes' antes de usarlo
console.log(`[${resultados}] Tipo de 'routes' antes de app.use: ${typeof routes}`);
if (typeof routes !== 'function') {
    console.error(`💥 [resultados-service] ERROR: 'routes' no es un router de Express. Tipo: ${typeof routes}`);
    // Esto es un error crítico si el router no fue importado correctamente.
    // Detener el proceso para evitar un bucle de 404s.
    process.exit(1);
}


// Rutas de negocio de este micro‑servicio
// CAMBIO CLAVE: Montar el router en la raíz '/'
// Porque Nginx ya removió el '/api/resultados' y envía solo '/'
app.use('/', routes);

// ───────────── Iniciar servidor ─────────────
app.listen(PORT, () => {
  console.log(`[${resultados}] escuchando en el puerto ${PORT}`);
});
