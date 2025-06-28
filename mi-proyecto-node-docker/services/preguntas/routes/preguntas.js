const express = require('express');
const router = express.Router();
const pool = require('../db');
// ¡IMPORTACIONES CORREGIDAS! La ruta correcta a _common es '../../services/_common/middleware/'
// Razonamiento de la ruta:
// 1. De 'routes/' (dentro de 'preguntas-service/') subes a 'preguntas-service/' (../)
// 2. De 'preguntas-service/' subes a '/app/' (../)
// 3. De '/app/' bajas a 'services/_common/middleware/'
const verificarToken = require('../../_common/middleware/verifyToken');
const authorizeRoles = require('../../_common/middleware/authorizeRoles');

// RUTA: Crear una nueva pregunta
// Protegida para docentes y administradores
router.post('/crear-pregunta', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const {
    enunciado,
    imagen, // La columna 'imagen' existe en tu tabla preguntas
    opcion_a,
    opcion_b,
    opcion_c,
    opcion_d,
    respuesta_correcta, // Columna de tipo VARCHAR(1) en DB
    materia_id
  } = req.body;

  // Validaciones básicas
  if (!enunciado || !opcion_a || !opcion_b || !opcion_c || !opcion_d || !respuesta_correcta || !materia_id) {
    console.warn('⚠️ Faltan campos obligatorios para crear pregunta.');
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Validación para la respuesta_correcta (debe ser 'A', 'B', 'C', o 'D')
  const validAnswers = ['A', 'B', 'C', 'D'];
  if (!validAnswers.includes(respuesta_correcta.toUpperCase())) {
      console.warn('⚠️ Respuesta correcta inválida:', respuesta_correcta);
      return res.status(400).json({ error: 'Respuesta correcta debe ser A, B, C o D.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO preguntas (
        enunciado, imagen, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, materia_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [enunciado, imagen || null, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta.toUpperCase(), materia_id]
    );
    console.log('✅ Pregunta creada:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('💥 Error al crear la pregunta:', err);
    res.status(500).json({ error: 'Error al crear la pregunta', detalle: err.message });
  }
});

// RUTA: Obtener preguntas (filtradas por materia_id o búsqueda en enunciado)
// Protegida para docentes, alumnos y administradores
router.get('/', verificarToken, authorizeRoles(['docente', 'alumno', 'admin']), async (req, res) => {
  const { materia_id, busqueda } = req.query;

  let baseQuery = 'SELECT id, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, materia_id FROM preguntas'; // Seleccionar todas las columnas relevantes
  const conditions = [];
  const values = [];

  console.log('--- ENTRANDO A GET /api/preguntas ---');
  console.log('Parámetros de consulta:', { materia_id, busqueda });
  console.log('Usuario autenticado (desde token):', req.usuario); // Log de depuración

  if (materia_id) {
    values.push(materia_id);
    conditions.push(`materia_id = $${values.length}`);
  }

  if (busqueda) {
    values.push(`%${busqueda}%`);
    conditions.push(`enunciado ILIKE $${values.length}`);
  }

  if (conditions.length > 0) {
    baseQuery += ' WHERE ' + conditions.join(' AND ');
  }

  baseQuery += ' ORDER BY id ASC'; // Opcional: ordenar para consistencia

  try {
    const result = await pool.query(baseQuery, values);
    console.log(`✅ Preguntas obtenidas. Cantidad: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error('💥 Error al obtener preguntas:', err);
    res.status(500).json({ error: 'Error al obtener preguntas', detalle: err.message });
  }
});

// RUTA: Eliminar una pregunta por ID
// Protegida para docentes y administradores
router.delete('/eliminar-pregunta/:id', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { id } = req.params;

  console.log(`--- INTENTANDO ELIMINAR PREGUNTA ID: ${id} ---`);

  try {
    const result = await pool.query(
      'DELETE FROM preguntas WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️ Pregunta ID ${id} no encontrada para eliminar.`);
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }
    console.log(`✅ Pregunta ID ${id} eliminada.`);
    res.json({ mensaje: 'Pregunta eliminada', pregunta: result.rows[0] });
  } catch (err) {
    // Código de error 23503 es para violación de foreign key (si la pregunta está en ensayo_pregunta)
    if (err.code === '23503') {
      console.warn(`❌ Error FK al eliminar pregunta ${id}: Asociada a un ensayo.`);
      return res.status(400).json({ error: 'No se puede eliminar: esta pregunta ya está asociada a un ensayo' });
    }
    console.error('💥 Error al eliminar pregunta:', err);
    res.status(500).json({ error: 'Error al eliminar pregunta', detalle: err.message });
  }
});

// RUTA: Actualizar una pregunta por ID
// Protegida para docentes y administradores
router.put('/:id', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => { // La ruta es solo /:id
  const { id } = req.params;
  const {
    enunciado,
    opcion_a,
    opcion_b,
    opcion_c,
    opcion_d,
    respuesta_correcta,
    materia_id,
    imagen
  } = req.body;

  console.log(`--- INTENTANDO ACTUALIZAR PREGUNTA ID: ${id} ---`);

  // Validaciones
  if (!enunciado || !opcion_a || !opcion_b || !opcion_c || !opcion_d || !respuesta_correcta || !materia_id) {
    console.warn('⚠️ Faltan campos obligatorios para actualizar pregunta.');
    return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar la pregunta' });
  }

  const validAnswers = ['A', 'B', 'C', 'D'];
  if (!validAnswers.includes(respuesta_correcta.toUpperCase())) {
      console.warn('⚠️ Respuesta correcta inválida al actualizar:', respuesta_correcta);
      return res.status(400).json({ error: 'Respuesta correcta debe ser A, B, C o D.' });
  }

  try {
    const result = await pool.query(
      'UPDATE preguntas SET enunciado = $1, opcion_a = $2, opcion_b = $3, opcion_c = $4, opcion_d = $5, respuesta_correcta = $6, materia_id = $7, imagen = $8 WHERE id = $9 RETURNING *',
      [enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta.toUpperCase(), materia_id, imagen || null, id]
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️ Pregunta ID ${id} no encontrada para actualizar.`);
      return res.status(404).json({ error: 'Pregunta no encontrada para actualizar' });
    }
    console.log(`✅ Pregunta ID ${id} actualizada.`);
    res.status(200).json({ mensaje: 'Pregunta actualizada', pregunta: result.rows[0] });
  } catch (err) {
    console.error('💥 Error al actualizar la pregunta:', err);
    res.status(500).json({ error: 'Error al actualizar la pregunta', detalle: err.message });
  }
});

module.exports = router;
