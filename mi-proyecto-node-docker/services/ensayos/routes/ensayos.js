const express = require('express');
const router = express.Router();
const pool = require('../db');
const authorizeRoles = require('../../_common/middleware/authorizeRoles');

// ==================================================================
// 1. GESTIÓN DE ENSAYOS (CRUD BÁSICO - DOCENTES/ADMINS)
// ==================================================================
router.post('/crear-ensayo-con-preguntas', authorizeRoles(['docente', 'admin']), async (req, res) => {
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

/**
 * @route   GET /:ensayo_id/preguntas
 * @desc    Obtiene los detalles de un ensayo y todas sus preguntas.
 * @access  Private (docente, admin)
 */
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

/**
 * @route   GET /listar-todos
 * @desc    Lista todos los ensayos con el nombre de su materia.
 * @access  Private (todos los roles)
 */
router.get('/listar-todos', authorizeRoles(['alumno', 'docente', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id,
        e.nombre,
        e.fecha_creacion,
        e.docente_id,
        e.materia_id,
        e.disponibilidad,      -- <== agregar
        e.max_intentos,        -- <== agregar
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

router.post('/:ensayo_id/ventanas', authorizeRoles(['docente', 'admin']), async (req, res) => {
  const { ensayo_id } = req.params;
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

// ==================================================================
// 3. VISTA DEL ALUMNO (URL CORREGIDA)
// ==================================================================
router.get('/disponibles-para-alumno', authorizeRoles(['alumno']), async (req, res) => {
    // 1. Añadimos una guarda de seguridad para asegurar que req.usuario existe
    if (!req.usuario || !req.usuario.id) {
        console.error('CRITICAL: /disponibles-para-alumno llamado pero req.usuario.id es nulo.');
        return res.status(401).json({ error: 'Información de usuario inválida en el token.' });
    }
    const alumno_id = req.usuario.id;

    try {
        const query = `
            SELECT q.* FROM (
                -- Ensayos por Ventana Activa (que no han sido rendidos)
                SELECT 
                    e.id AS ensayo_id, e.nombre AS titulo, 'ventana' AS tipo, 
                    vr.id AS ventana_id, vr.inicio, vr.fin, vr.duracion_min, m.nombre AS materia_nombre
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
                    NULL AS ventana_id, NULL AS inicio, NULL AS fin, NULL AS duracion_min, m.nombre AS materia_nombre
                FROM ensayos e
                JOIN materias m ON e.materia_id = m.id
                WHERE e.disponibilidad = 'permanente'
            ) as q
            ORDER BY q.tipo DESC, q.titulo ASC;
        `;

        const result = await pool.query(query, [alumno_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('💥 Error al listar ensayos para alumno:', error);
        res.status(500).json({ error: 'Error interno del servidor.', detalle: error.message });
    }
});

module.exports = router;