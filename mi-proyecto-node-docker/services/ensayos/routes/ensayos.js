const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../../_common/middleware/verifyToken');
const authorizeRoles = require('../../_common/middleware/authorizeRoles');

// RUTA: Crear un nuevo ensayo (sin preguntas asociadas directamente aquí)
// Protegida para docentes y administradores
router.post('/crear-ensayo', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { nombre, docente_id, materia_id } = req.body;

  if (!nombre || !docente_id || !materia_id) {
    console.warn('⚠️ Faltan campos obligatorios para crear ensayo.');
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const fecha_creacion = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      'INSERT INTO ensayos (nombre, fecha_creacion, docente_id, materia_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, fecha_creacion, docente_id, materia_id]
    );
    console.log('✅ Ensayo creado:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('💥 Error al crear ensayo:', err);
    res.status(500).json({ error: 'Error al crear ensayo', detalle: err.message });
  }
});

// RUTA: Crear un ensayo y asociarlo con preguntas
// Protegida para docentes y administradores
router.post('/crear-ensayo-con-preguntas', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { nombre, docente_id, materia_id, preguntas } = req.body;

  if (!nombre || !docente_id || !materia_id || !Array.isArray(preguntas) || preguntas.length === 0) {
    console.warn('⚠️ Faltan campos o la lista de preguntas está vacía para crear ensayo con preguntas.');
    return res.status(400).json({ error: 'Faltan campos o la lista de preguntas está vacía' });
  }

  if (req.usuario.rol !== 'docente' && req.usuario.rol !== 'admin') {
      console.warn(`❌ Intento de crear ensayo con preguntas por rol no permitido: ${req.usuario.rol}`);
      return res.status(403).json({ error: 'Acceso denegado: Solo docentes o administradores pueden crear ensayos con preguntas' });
  }

  try {
    const fecha_creacion = new Date().toISOString().split('T')[0];

    // 1. Crear el ensayo
    const ensayoResult = await pool.query(
      `INSERT INTO ensayos (nombre, fecha_creacion, docente_id, materia_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, fecha_creacion, docente_id, materia_id]
    );

    const ensayoId = ensayoResult.rows[0].id;

    // 2. Insertar relaciones ensayo-pregunta
    const insertValues = [];
    let paramIndex = 1;
    const valuesPlaceholder = preguntas.map(() => {
      const placeholder = `($${paramIndex++}, $${paramIndex++})`;
      return placeholder;
    }).join(',');

    preguntas.forEach(preguntaId => {
      insertValues.push(ensayoId);
      insertValues.push(preguntaId);
    });
    
    const query = `INSERT INTO ensayo_pregunta (ensayo_id, pregunta_id) VALUES ${valuesPlaceholder}`;
    await pool.query(query, insertValues);

    console.log(`✅ Ensayo ${ensayoId} creado con ${preguntas.length} preguntas asociadas.`);
    res.status(201).json({ mensaje: 'Ensayo creado con preguntas asociadas', ensayo: ensayoResult.rows[0] });
  } catch (err) {
    console.error('💥 Error al crear ensayo con preguntas:', err);
    res.status(500).json({ error: 'Error al crear ensayo con preguntas', detalle: err.message });
  }
});

// RUTA: Obtener ensayos (filtrados por materia_id o docente_id)
// Protegida para docentes y administradores que buscan sus propios ensayos, o admins
router.get('/ver-ensayos', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { materia_id, docente_id } = req.query; 

  let query = 'SELECT * FROM ensayos';
  const conditions = [];
  const values = [];
  let paramCounter = 1;

  if (req.usuario.rol === 'docente' && req.usuario.id !== docente_id) {
    conditions.push(`docente_id = $${paramCounter++}`);
    values.push(req.usuario.id);
  } else if (docente_id) {
    conditions.push(`docente_id = $${paramCounter++}`);
    values.push(docente_id);
  }

  if (materia_id) {
    conditions.push(`materia_id = $${paramCounter++}`);
    values.push(materia_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  try {
    const result = await pool.query(query, values);
    console.log(`✅ ${result.rows.length} ensayos obtenidos.`);
    res.json(result.rows);
  } catch (err) {
    console.error('💥 Error al obtener los ensayos:', err);
    res.status(500).json({ error: 'Error al obtener los ensayos', detalle: err.message });
  }
});


// RUTA: Obtener ensayos disponibles para un alumno (que aún no ha rendido)
// Protegida para alumnos
router.get('/ver-ensayos-disponibles', verificarToken, authorizeRoles(['alumno']), async (req, res) => {
  const alumno_id = req.usuario.id; 

  if (!alumno_id) {
    console.warn('⚠️ Falta alumno_id en el token para ver ensayos disponibles.');
    return res.status(400).json({ error: 'Falta alumno_id en el token' });
  }

  try {
    const result = await pool.query(`
      SELECT e.id, e.nombre, m.nombre AS materia, e.fecha_creacion
      FROM ensayos e
      JOIN materias m ON e.materia_id = m.id
      WHERE e.id NOT IN (
        SELECT ensayo_id FROM resultados WHERE alumno_id = $1
      )
      ORDER BY e.fecha_creacion DESC
    `, [alumno_id]);
    console.log(`✅ ${result.rows.length} ensayos disponibles para alumno ID: ${alumno_id}`);
    res.json(result.rows);
  } catch (err) {
    console.error('💥 Error al obtener ensayos disponibles:', err);
    res.status(500).json({ error: 'Error al obtener ensayos disponibles', detalle: err.message });
  }
});

// NUEVA RUTA: Obtener los detalles de un ensayo y sus preguntas asociadas por ID de ensayo
// Protegida para docentes y administradores
router.get('/:ensayo_id/preguntas', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { ensayo_id } = req.params;

  console.log(`--- ENTRANDO A GET /api/ensayos/${ensayo_id}/preguntas ---`);
  console.log(`Solicitud para ensayo ID: ${ensayo_id}`);

  if (!ensayo_id) {
    console.warn('⚠️ Falta ensayo_id en los parámetros de la URL.');
    return res.status(400).json({ error: 'Falta el ID del ensayo' });
  }

  try {
    // 1. Obtener los detalles del ensayo
    const ensayoDetails = await pool.query(
      'SELECT e.id, e.nombre, e.fecha_creacion, e.docente_id, e.materia_id, m.nombre as materia_nombre FROM ensayos e JOIN materias m ON e.materia_id = m.id WHERE e.id = $1',
      [ensayo_id]
    );

    if (ensayoDetails.rows.length === 0) {
      console.warn(`❌ Ensayo ID ${ensayo_id} no encontrado.`);
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }
    const ensayo = ensayoDetails.rows[0];

    // Verificar que el docente logueado sea el dueño del ensayo (si no es admin)
    if (req.usuario.rol === 'docente' && ensayo.docente_id !== req.usuario.id) {
      console.warn(`❌ Acceso denegado: Docente ID ${req.usuario.id} intentó acceder a ensayo de otro docente (${ensayo.docente_id}).`);
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para ver este ensayo.' });
    }

    // 2. Obtener las preguntas asociadas a este ensayo
    const preguntasRaw = await pool.query(`
      SELECT
          p.id AS pregunta_id,
          p.enunciado,
          p.imagen,
          p.opcion_a,
          p.opcion_b,
          p.opcion_c,
          p.opcion_d,
          p.respuesta_correcta
      FROM ensayo_pregunta ep
      JOIN preguntas p ON ep.pregunta_id = p.id
      WHERE ep.ensayo_id = $1
      ORDER BY p.id
    `, [ensayo_id]);

    console.log(`✅ Preguntas obtenidas para Ensayo ID ${ensayo_id}. Total: ${preguntasRaw.rows.length} preguntas.`);
    res.status(200).json({
      ensayo: ensayo,
      preguntas: preguntasRaw.rows
    });

  } catch (err) {
    console.error('💥 Error en GET /api/ensayos/:ensayo_id/preguntas:', err);
    res.status(500).json({ error: 'Error del servidor al obtener preguntas del ensayo', detalle: err.message });
  }
});


// NUEVA RUTA: Actualizar un ensayo por ID (nombre, materia_id)
// Protegida para docentes (dueños) y administradores
router.put('/:id', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { nombre, materia_id } = req.body;

  if (!nombre || !materia_id) {
    console.warn('⚠️ Faltan campos obligatorios para actualizar ensayo.');
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // 1. Verificar si el ensayo existe y si el usuario tiene permiso (docente es el dueño o es admin)
    const currentEnsayo = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [id]);
    if (currentEnsayo.rows.length === 0) {
      console.warn(`⚠️ Ensayo ID ${id} no encontrado para actualizar.`);
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    if (req.usuario.rol === 'docente' && currentEnsayo.rows[0].docente_id !== req.usuario.id) {
      console.warn(`❌ Acceso denegado: Docente ID ${req.usuario.id} intentó actualizar ensayo de otro docente.`);
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para actualizar este ensayo.' });
    }

    // 2. Realizar la actualización
    const result = await pool.query(
      'UPDATE ensayos SET nombre = $1, materia_id = $2 WHERE id = $3 RETURNING *',
      [nombre, materia_id, id]
    );

    console.log(`✅ Ensayo ID ${id} actualizado.`);
    res.status(200).json({ mensaje: 'Ensayo actualizado', ensayo: result.rows[0] });
  } catch (err) {
    console.error('💥 Error al actualizar el ensayo:', err);
    res.status(500).json({ error: 'Error al actualizar el ensayo', detalle: err.message });
  }
});

// NUEVA RUTA: Eliminar un ensayo por ID
// Protegida para docentes (dueños) y administradores
router.delete('/:id', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { id } = req.params;

  console.log(`--- INTENTANDO ELIMINAR ENSAYO ID: ${id} ---`);

  try {
    // 1. Verificar si el ensayo existe y si el usuario tiene permiso
    const currentEnsayo = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [id]);
    if (currentEnsayo.rows.length === 0) {
      console.warn(`⚠️ Ensayo ID ${id} no encontrado para eliminar.`);
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    if (req.usuario.rol === 'docente' && currentEnsayo.rows[0].docente_id !== req.usuario.id) {
      console.warn(`❌ Acceso denegado: Docente ID ${req.usuario.id} intentó eliminar ensayo de otro docente.`);
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para eliminar este ensayo.' });
    }

    // 2. Eliminar relaciones en ensayo_pregunta primero para evitar FK error
    await pool.query('DELETE FROM ensayo_pregunta WHERE ensayo_id = $1', [id]);
    console.log(`✅ Relaciones de preguntas eliminadas para ensayo ID: ${id}`);

    // 3. Eliminar el ensayo
    const result = await pool.query('DELETE FROM ensayos WHERE id = $1 RETURNING *', [id]);

    console.log(`✅ Ensayo ID ${id} eliminado.`);
    res.json({ mensaje: 'Ensayo eliminado', ensayo: result.rows[0] });
  } catch (err) {
    console.error('💥 Error al eliminar ensayo:', err);
    res.status(500).json({ error: 'Error al eliminar ensayo', detalle: err.message });
  }
});


// NUEVA RUTA: Agregar una pregunta a un ensayo (relación ensayo_pregunta)
// Protegida para docentes (dueños) y administradores
router.post('/:ensayo_id/preguntas/:pregunta_id', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { ensayo_id, pregunta_id } = req.params;

  console.log(`--- INTENTANDO AGREGAR PREGUNTA ${pregunta_id} a ENSAYO ${ensayo_id} ---`);

  try {
    // 1. Verificar que el ensayo exista y el usuario tenga permiso
    const ensayoCheck = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [ensayo_id]);
    if (ensayoCheck.rows.length === 0) {
      console.warn(`⚠️ Ensayo ID ${ensayo_id} no encontrado para agregar pregunta.`);
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }
    if (req.usuario.rol === 'docente' && ensayoCheck.rows[0].docente_id !== req.usuario.id) {
      console.warn(`❌ Acceso denegado: Docente ID ${req.usuario.id} intentó agregar pregunta a ensayo de otro docente.`);
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para modificar este ensayo.' });
    }

    // 2. Verificar que la pregunta exista
    const preguntaCheck = await pool.query('SELECT id FROM preguntas WHERE id = $1', [pregunta_id]);
    if (preguntaCheck.rows.length === 0) {
      console.warn(`⚠️ Pregunta ID ${pregunta_id} no encontrada.`);
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    // 3. Insertar la relación (ignorar si ya existe)
    await pool.query(
      'INSERT INTO ensayo_pregunta (ensayo_id, pregunta_id) VALUES ($1, $2) ON CONFLICT (ensayo_id, pregunta_id) DO NOTHING',
      [ensayo_id, pregunta_id]
    );

    console.log(`✅ Pregunta ${pregunta_id} agregada a Ensayo ${ensayo_id}.`);
    res.status(200).json({ mensaje: 'Pregunta agregada al ensayo' });
  } catch (err) {
    console.error('💥 Error al agregar pregunta al ensayo:', err);
    res.status(500).json({ error: 'Error al agregar pregunta al ensayo', detalle: err.message });
  }
});


// NUEVA RUTA: Eliminar una pregunta de un ensayo (relación ensayo_pregunta)
// Protegida para docentes (dueños) y administradores
router.delete('/:ensayo_id/preguntas/:pregunta_id', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { ensayo_id, pregunta_id } = req.params;

  console.log(`--- INTENTANDO ELIMINAR PREGUNTA ${pregunta_id} de ENSAYO ${ensayo_id} ---`);

  try {
    // 1. Verificar que el ensayo exista y el usuario tenga permiso
    const ensayoCheck = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [ensayo_id]);
    if (ensayoCheck.rows.length === 0) {
      console.warn(`⚠️ Ensayo ID ${ensayo_id} no encontrado para eliminar pregunta.`);
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }
    if (req.usuario.rol === 'docente' && ensayoCheck.rows[0].docente_id !== req.usuario.id) {
      console.warn(`❌ Acceso denegado: Docente ID ${req.usuario.id} intentó eliminar pregunta de ensayo de otro docente.`);
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para modificar este ensayo.' });
    }

    // 2. Eliminar la relación
    const result = await pool.query(
      'DELETE FROM ensayo_pregunta WHERE ensayo_id = $1 AND pregunta_id = $2 RETURNING *',
      [ensayo_id, pregunta_id]
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️ Relación no encontrada: Pregunta ${pregunta_id} no estaba en Ensayo ${ensayo_id}.`);
      return res.status(404).json({ error: 'Pregunta no encontrada en este ensayo' });
    }

    console.log(`✅ Pregunta ${pregunta_id} eliminada de Ensayo ${ensayo_id}.`);
    res.status(200).json({ mensaje: 'Pregunta eliminada del ensayo' });
  } catch (err) {
    console.error('💥 Error al eliminar pregunta del ensayo:', err);
    res.status(500).json({ error: 'Error al eliminar pregunta del ensayo', detalle: err.message });
  }
});


// RUTA: Listar todos los ensayos con nombre de materia (usado por VerEnsayos.jsx y ModificarEnsayos.jsx)
// Protegida para alumnos y docentes (depende de quién los solicite)
router.get('/listar-todos', verificarToken, authorizeRoles(['alumno', 'docente', 'admin']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id, e.nombre, e.fecha_creacion, e.docente_id, e.materia_id, m.nombre AS nombre_materia
            FROM ensayos e
            JOIN materias m ON e.materia_id = m.id
            ORDER BY e.fecha_creacion DESC
        `);
        console.log(`✅ ${result.rows.length} ensayos listados.`);
        res.json(result.rows);
    } catch (error) {
        console.error('💥 Error al obtener ensayos en /listar-todos:', error);
        res.status(500).json({ error: 'Error al obtener ensayos', detalle: error.message });
    }
});


module.exports = router;
