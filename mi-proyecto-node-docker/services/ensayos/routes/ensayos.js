const express = require('express');
const router = express.Router();
const pool = require('../db');
const authorizeRoles = require('../../_common/middleware/authorizeRoles');

// ==================================================================
// 1. GESTIÓN DE ENSAYOS (CRUD BÁSICO - DOCENTES/ADMINS)
// ==================================================================
router.post('/crear-ensayo-con-preguntas', authorizeRoles(['docente', 'admin']), async (req, res) => {
  // ... (Esta función estaba correcta, no necesita cambios) ...
  let nombre = req.body.nombre || req.body.titulo;
  const { materia_id, preguntas, disponibilidad = 'permanente', max_intentos = null } = req.body;
  const docente_id = req.usuario?.id;

  if (!nombre || !docente_id || !materia_id || !preguntas || !Array.isArray(preguntas) || preguntas.length === 0) {
      return res.status(400).json({ error: 'Título, materia y un array de preguntas son requeridos.' });
  }
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      const ensayoResult = await client.query(`INSERT INTO ensayos (nombre, docente_id, materia_id, disponibilidad, max_intentos) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre`, [nombre, docente_id, materia_id, disponibilidad, max_intentos]);
      const ensayoId = ensayoResult.rows[0].id;
      const insertValues = [];
      let paramIndex = 1;
      const valuesPlaceholder = preguntas.map(pId => {
          insertValues.push(ensayoId, Number(pId));
          return `($${paramIndex++}, $${paramIndex++})`;
      }).join(',');
      if (insertValues.length > 0) {
          await client.query(`INSERT INTO ensayo_pregunta (ensayo_id, pregunta_id) VALUES ${valuesPlaceholder}`, insertValues);
      }
      await client.query('COMMIT');
      res.status(201).json({ mensaje: 'Ensayo creado exitosamente', ensayo: ensayoResult.rows[0] });
  } catch (error) {
      await client.query('ROLLBACK');
      console.error('💥 Error al crear ensayo con preguntas:', error);
      if (error.code === '23503') return res.status(400).json({ error: 'Una o más de las preguntas proporcionadas no existen.' });
      res.status(500).json({ error: 'Error interno del servidor.', detalle: error.message });
  } finally {
      client.release();
  }
});

router.put('/:id', authorizeRoles(['docente', 'admin']), async (req, res) => {
 const { id } = req.params;
 const { nombre, materia_id, disponibilidad, max_intentos } = req.body;
 const docente_id_token = req.usuario?.id; // ID del docente desde el token

 // Validaciones básicas del body
 if (!nombre || !materia_id || !disponibilidad) {
  return res.status(400).json({ error: 'Nombre, materia_id y disponibilidad son requeridos.' });
 }
  // (max_intentos puede ser null, así que no lo validamos como 'requerido')

 try {
  // 1. Verificar que el ensayo existe y que el docente es el propietario
  const ensayoRes = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [id]);
  if (ensayoRes.rowCount === 0) {
   return res.status(404).json({ error: 'Ensayo no encontrado.' });
  }

    // 2. Chequeo de permisos (solo admin o el docente dueño pueden editar)
  if (req.usuario.rol === 'docente' && ensayoRes.rows[0].docente_id !== docente_id_token) {
   return res.status(403).json({ error: 'No tienes permiso para modificar este ensayo.' });
  }

  // 3. Actualizar el ensayo en la base de datos
  const updateRes = await pool.query(
   `UPDATE ensayos 
   SET 
    nombre = $1, 
    materia_id = $2, 
    disponibilidad = $3, 
    max_intentos = $4
   WHERE id = $5
   RETURNING *`, // Devuelve el ensayo completo actualizado
   [nombre, materia_id, disponibilidad, max_intentos, id]
  );

  // El frontend (ModificarEnsayos.jsx) espera una respuesta { ensayo: {...} }
  return res.status(200).json({ ensayo: updateRes.rows[0] });

 } catch (err) {
  console.error('💥 Error en PUT /:id:', err);
    if (err.code === '23503') { // Foreign key constraint (ej. materia_id no existe)
        return res.status(400).json({ error: 'La materia seleccionada no es válida.' });
    }
 return res.status(500).json({ error: 'Error interno del servidor.', detalle: err.message });
 }
});

// ... (GET /:ensayo_id/preguntas sin cambios) ...
router.get('/:ensayo_id/preguntas', authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { ensayo_id } = req.params;
  try {
      const ensayoDetails = await pool.query('SELECT e.*, m.nombre as materia_nombre FROM ensayos e JOIN materias m ON e.materia_id = m.id WHERE e.id = $1', [ensayo_id]);
      if (ensayoDetails.rowCount === 0) return res.status(404).json({ error: 'Ensayo no encontrado' });
      
      const ensayo = ensayoDetails.rows[0];
      if (req.usuario.rol === 'docente' && ensayo.docente_id !== req.usuario.id) {
          return res.status(403).json({ error: 'No tienes permiso para ver este ensayo.' });
      }

      const preguntasResult = await pool.query(`SELECT p.* FROM ensayo_pregunta ep JOIN preguntas p ON ep.pregunta_id = p.id WHERE ep.ensayo_id = $1 ORDER BY p.id`, [ensayo_id]);
      res.status(200).json({ ensayo, preguntas: preguntasResult.rows });
  } catch (err) {
      console.error(`💥 Error en GET /${ensayo_id}/preguntas:`, err);
      res.status(500).json({ error: 'Error del servidor al obtener el ensayo.', detalle: err.message });
  }
});

// ... (GET /listar-todos sin cambios) ...
router.get('/listar-todos', authorizeRoles(['alumno', 'docente', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id,
        e.nombre,
        e.fecha_creacion,
        e.docente_id,
        e.materia_id,
        e.disponibilidad,
        e.max_intentos,
        m.nombre AS nombre_materia
      FROM ensayos e
      JOIN materias m ON e.materia_id = m.id
      ORDER BY e.fecha_creacion DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('💥 Error en /listar-todos:', error);
    res.status(500).json({ error: 'Error al obtener ensayos', detalle: error.message });
  }
});

// ==================================================================
// 2. GESTIÓN DE VENTANAS DE RENDICIÓN (HU-009)
// ==================================================================
// ... (GET /:ensayo_id/ventanas sin cambios) ...
router.get('/:ensayo_id/ventanas', authorizeRoles(['alumno','docente','admin']), async (req, res) => {
  const { ensayo_id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, ensayo_id, curso_id, inicio, fin, duracion_min
       FROM ventanas_rendicion
       WHERE ensayo_id = $1
       ORDER BY inicio ASC`,
      [ensayo_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('💥 GET /:ensayo_id/ventanas:', err);
    res.status(500).json({ error: 'Error al listar ventanas.' });
  }
});

// ... (POST /:ensayo_id/ventanas sin cambios, ya estaba correcto) ...
router.post('/:ensayo_id/ventanas', authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { ensayo_id } = req.params;
  // El frontend ahora envía 'curso_id' (snake_case)
  const { curso_id, inicio, duracion_min } = req.body;

  if (!curso_id || !inicio || !duracion_min) {
    return res.status(400).json({ error: 'curso_id, inicio y duracion_min son requeridos.' });
  }

  try {
    // validar ensayo y propiedad del docente
    const { rows: eRows } = await pool.query(
      `SELECT docente_id, disponibilidad FROM ensayos WHERE id = $1`,
      [ensayo_id]
    );
    if (eRows.length === 0) return res.status(404).json({ error: 'El ensayo no existe.' });
    const ensayo = eRows[0];

    if (ensayo.disponibilidad !== 'ventana') {
      return res.status(400).json({ error: 'Solo se pueden asignar ventanas a ensayos de tipo "ventana".' });
    }

    if (req.usuario?.id !== ensayo.docente_id) {
      return res.status(403).json({ error: 'No tienes permiso para asignar este ensayo.' });
    }

    // validar membresía del docente en el curso
    const { rowCount: memb } = await pool.query(
      `SELECT 1 FROM curso_miembros
       WHERE curso_id = $1 AND usuario_id = $2 AND rol_en_curso = 'docente'`,
      [curso_id, req.usuario.id]
    );
    if (memb === 0) return res.status(403).json({ error: 'No perteneces a este curso como docente.' });

    // calcular fin
    const ini = new Date(inicio);
    const fin = new Date(ini.getTime() + Number(duracion_min) * 60000);

    // crear ventana con rango
    const { rows } = await pool.query(
      `INSERT INTO ventanas_rendicion (ensayo_id, curso_id, inicio, fin, duracion_min, periodo)
       VALUES ($1, $2, $3, $4, $5, tstzrange($3, $4, '[]'))
       RETURNING id, ensayo_id, curso_id, inicio, fin, duracion_min, created_at, updated_at, periodo`,
      [ensayo_id, curso_id, ini.toISOString(), fin.toISOString(), duracion_min]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Conflicto: ya existe una ventana que se solapa para este curso/ensayo.' });
    }
    console.error('💥 Error al crear ventana:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* --- AÑADIR ESTE BLOQUE (PUT para actualizar ventana) --- */
router.put('/ventanas/:id', authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { curso_id, inicio, duracion_min } = req.body;
  const docente_id_token = req.usuario?.id;

  if (!curso_id || !inicio || !duracion_min) {
    return res.status(400).json({ error: 'curso_id, inicio y duracion_min son requeridos.' });
 }

  try {
    // 1. Validar que la ventana existe y obtener el ensayo_id
    const vRes = await pool.query('SELECT ensayo_id FROM ventanas_rendicion WHERE id = $1', [id]);
    if (vRes.rowCount === 0) {
      return res.status(404).json({ error: 'Ventana no encontrada.' });
    }
    const { ensayo_id } = vRes.rows[0];

    // 2. Validar que el docente es dueño del ensayo al que pertenece la ventana
    const eRes = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [ensayo_id]);
    if (req.usuario.rol === 'docente' && eRes.rows[0]?.docente_id !== docente_id_token) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta ventana.' });
    }

    // 3. Calcular fin y actualizar la ventana
    const ini = new Date(inicio);
    const fin = new Date(ini.getTime() + Number(duracion_min) * 60000);

  const { rows } = await pool.query(
   `UPDATE ventanas_rendicion 
   SET 
    curso_id = $1, 
    inicio = $2, 
    fin = $3, 
    duracion_min = $4, 
    periodo = tstzrange($2, $3, '[]'),
    updated_at = NOW()
   WHERE id = $5
   RETURNING *`,
   [curso_id, ini.toISOString(), fin.toISOString(), duracion_min, id]
  );
  return res.status(200).json(rows[0]);
 } catch (err) {
  if (err.code === '23P01') { // Error de solapamiento (EXCLUDE constraint)
   return res.status(409).json({ error: 'Conflicto: ya existe una ventana que se solapa para este curso/ensayo.' });
  }
  console.error('💥 Error en PUT /ventanas/:id:', err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
 }
});

/* --- AÑADIR ESTE BLOQUE (DELETE para borrar ventana) --- */
router.delete('/ventanas/:id', authorizeRoles(['docente', 'admin']), async (req, res) => {
 const { id } = req.params;
 const docente_id_token = req.usuario?.id;

 try {
    // 1. Validar que la ventana existe y obtener el ensayo_id
  const vRes = await pool.query('SELECT ensayo_id FROM ventanas_rendicion WHERE id = $1', [id]);
  if (vRes.rowCount === 0) {
   return res.status(404).json({ error: 'Ventana no encontrada.' });
  }
  const { ensayo_id } = vRes.rows[0];

    // 2. Validar que el docente es dueño del ensayo
  const eRes = await pool.query('SELECT docente_id FROM ensayos WHERE id = $1', [ensayo_id]);
  if (req.usuario.rol === 'docente' && eRes.rows[0]?.docente_id !== docente_id_token) {
   return res.status(403).json({ error: 'No tienes permiso para eliminar esta ventana.' });
  }

    // 3. Eliminar la ventana
    // (Asegúrate de que tu DB tenga ON DELETE SET NULL en la FK de 'resultados' a 'ventanas_rendicion'
    // si no quieres que borrar una ventana borre los resultados)
  await pool.query('DELETE FROM ventanas_rendicion WHERE id = $1', [id]);
  
  return res.status(204).send(); // 204 No Content
 } catch (err) {
  console.error('💥 Error en DELETE /ventanas/:id:', err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
 }
});


// ==================================================================
// 3. VISTA DEL ALUMNO (URL CORREGIDA Y BUG MAX_INTENTOS)
// ==================================================================
router.get('/disponibles-para-alumno', authorizeRoles(['alumno']), async (req, res) => {
    if (!req.usuario || !req.usuario.id) {
        console.error('CRITICAL: /disponibles-para-alumno llamado pero req.usuario.id es nulo.');
        return res.status(401).json({ error: 'Información de usuario inválida en el token.' });
    }
    const alumno_id = req.usuario.id;

    try {
        // --- (CORRECCIÓN 3: Bug de max_intentos) ---
        // Añadimos e.max_intentos al primer SELECT (ensayos por ventana)
        const query = `
            SELECT q.* FROM (
                -- Ensayos por Ventana Activa (que no han sido rendidos)
                SELECT 
                    e.id AS ensayo_id, e.nombre AS titulo, 'ventana' AS tipo, 
                    vr.id AS ventana_id, vr.inicio, vr.fin, vr.duracion_min, m.nombre AS materia_nombre,
                    e.max_intentos -- <--- CAMPO AÑADIDO
                FROM ventanas_rendicion vr
                JOIN ensayos e ON vr.ensayo_id = e.id
                JOIN materias m ON e.materia_id = m.id
                WHERE 
                    vr.curso_id IN (SELECT curso_id FROM curso_miembros WHERE usuario_id = $1) 
                    AND NOW() BETWEEN vr.inicio AND vr.fin
                    AND NOT EXISTS (SELECT 1 FROM resultados WHERE alumno_id = $1 AND ventana_id = vr.id)
                
                UNION ALL
                
                -- Ensayos Permanentes
                SELECT 
                    e.id AS ensayo_id, e.nombre AS titulo, 'permanente' AS tipo, 
                    NULL AS ventana_id, NULL AS inicio, NULL AS fin, NULL AS duracion_min, m.nombre AS materia_nombre,
                    e.max_intentos -- (Este ya estaba aquí, pero lo alineamos)
                FROM ensayos e
                JOIN materias m ON e.materia_id = m.id
                WHERE e.disponibilidad = 'permanente'
            ) as q
            ORDER BY q.tipo DESC, q.titulo ASC;
        `;
        // --- (FIN CORRECCIÓN 3) ---

        const result = await pool.query(query, [alumno_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('💥 Error al listar ensayos para alumno:', error);
        res.status(500).json({ error: 'Error interno del servidor.', detalle: error.message });
    }
});

module.exports = router;