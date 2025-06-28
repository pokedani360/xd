const express = require('express');
const router = express.Router();
const pool = require('../db');
// Importa ambos middlewares: verificarToken y authorizeRoles
// ¡CAMBIO CLAVE AQUÍ! Asegúrate de desestructurar authorizeRoles también
const verificarToken = require('../../_common/middleware/verifyToken');
const authorizeRoles = require('../../_common/middleware/authorizeRoles');

console.log('--- routes/resultados.js: Middlewares importados ---'); // Nuevo log después de las importaciones
console.log('verificarToken es:', typeof verificarToken); // Verifica que no sea 'undefined'
console.log('authorizeRoles es:', typeof authorizeRoles); // Verifica que no sea 'undefined'

// NUEVO LOG: Middleware a nivel de router para ver el path antes de las rutas específicas
router.use((req, res, next) => {
    console.log(`[routes/resultados.js] Petición interna recibida: ${req.method} ${req.path}`);
    next();
});

// Crear un resultado al comenzar el ensayo
router.post(
  '/crear-resultado',
  verificarToken, 
  authorizeRoles(['alumno', 'admin']), 
  async (req, res) => {
    console.log('--- ENTRANDO A /crear-resultado (ROUTE HANDLER) ---'); // Log para confirmar que se entró al manejador de la ruta
    console.log('req.body recibido:', req.body); // Nuevo log para ver el cuerpo de la solicitud
    console.log('req.usuario (después de middlewares):', req.usuario); 

    if (req.usuario && req.usuario.rol) {
        console.log('Rol de usuario recibido en ruta:', req.usuario.rol);
    } else {
        console.warn('⚠️ req.usuario o req.usuario.rol no está definido al llegar a la ruta /crear-resultado');
    }

    const alumno_id = req.usuario ? req.usuario.id : null; // Asegurarse de que alumno_id no sea undefined si req.usuario no existe
    const { ensayo_id } = req.body;

    console.log(`Verificando datos: alumno_id=${alumno_id}, ensayo_id=${ensayo_id}`); // Nuevo log para ver los valores antes de la validación

    if (req.usuario.rol !== 'alumno' && req.usuario.rol !== 'admin') {
      console.warn(`❌ Intento de crear resultado por rol no permitido: ${req.usuario.rol}`);
      return res.status(403).json({ error: 'Solo alumnos o administradores pueden crear resultados' });
    }

    if (!ensayo_id || !alumno_id) {
      console.warn('⚠️ Faltan datos para crear resultado: ensayo_id o alumno_id');
      return res.status(400).json({ error: 'Faltan datos para crear el resultado' });
    }

    try {
      console.log('Intentando insertar en la base de datos...'); // Nuevo log antes de la consulta
      const result = await pool.query(
        `INSERT INTO resultados (ensayo_id, alumno_id)
         VALUES ($1, $2)
         RETURNING id`,
        [ensayo_id, alumno_id]
      );

      const resultado_id = result.rows[0].id;
      console.log(`✅ Resultado creado con ID: ${resultado_id} para alumno ID: ${alumno_id}`);
      res.status(201).json({ mensaje: 'Resultado creado', resultado_id });
    } catch (err) {
      console.error('💥 Error al crear resultado (DB QUERY FAILED):', err); // Más específico
      res.status(500).json({ error: 'Error interno del servidor al crear resultado', detalle: err.message });
    }
});

// NUEVA RUTA: Guardar una respuesta individual del alumno durante el ensayo
router.post(
  '/:resultado_id/responder', // La URL será /api/resultados/:resultado_id/responder
  verificarToken,
  authorizeRoles(['alumno', 'admin']),
  async (req, res) => {
    console.log(`--- ENTRANDO A POST /api/resultados/${req.params.resultado_id}/responder (ROUTE HANDLER) ---`);
    const { resultado_id } = req.params;
    const { pregunta_id, respuesta_dada } = req.body; // respuesta_dada será 'A', 'B', 'C', 'D'
    const alumno_id = req.usuario.id;

    console.log(`Resultado ID: ${resultado_id}, Pregunta ID: ${pregunta_id}, Respuesta Dada: ${respuesta_dada}, Alumno ID: ${alumno_id}`);

    if (!pregunta_id || !respuesta_dada) {
      console.warn('⚠️ Faltan datos para guardar la respuesta.');
      return res.status(400).json({ error: 'Faltan datos (pregunta_id o respuesta_dada)' });
    }

    try {
      console.log(`Verificando resultado ID ${resultado_id} y alumno ID ${alumno_id} en DB.`);
      // 1. Verificar que el resultado exista y pertenezca al alumno logueado
      const resultadoCheck = await pool.query(
        'SELECT ensayo_id FROM resultados WHERE id = $1 AND alumno_id = $2',
        [resultado_id, alumno_id]
      );

      if (resultadoCheck.rows.length === 0) {
        console.warn(`❌ Acceso denegado: Resultado ID ${resultado_id} no encontrado o no pertenece a alumno ID ${alumno_id}`);
        return res.status(403).json({ error: 'Acceso denegado o resultado no encontrado' });
      }
      console.log('Resultado y alumno verificados. Obteniendo respuesta correcta de la pregunta.');

      // 2. Obtener la respuesta correcta de la pregunta
      const preguntaData = await pool.query(
        'SELECT respuesta_correcta FROM preguntas WHERE id = $1',
        [pregunta_id]
      );

      if (preguntaData.rows.length === 0) {
        console.warn(`⚠️ Pregunta ID ${pregunta_id} no encontrada.`);
        return res.status(404).json({ error: 'Pregunta no encontrada.' });
      }

      const es_correcta = (respuesta_dada.toUpperCase() === preguntaData.rows[0].respuesta_correcta.toUpperCase());
      console.log(`Respuesta correcta para pregunta ${pregunta_id} es ${preguntaData.rows[0].respuesta_correcta}. Respuesta dada: ${respuesta_dada}. ¿Es correcta?: ${es_correcta}`);

      // 3. Insertar o actualizar la respuesta en la tabla 'respuestas'
      // Usamos ON CONFLICT (UPSERT) para actualizar si la respuesta ya existe para esa pregunta en ese resultado
      const query = `
        INSERT INTO respuestas (resultado_id, pregunta_id, respuesta_dada, correcta)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (resultado_id, pregunta_id) DO UPDATE
        SET respuesta_dada = EXCLUDED.respuesta_dada,
            correcta = EXCLUDED.correcta
        RETURNING *;
      `;
      const result = await pool.query(query, [resultado_id, pregunta_id, respuesta_dada.toUpperCase(), es_correcta]);
      
      console.log(`✅ Respuesta guardada/actualizada para pregunta ID ${pregunta_id}, Resultado ID ${resultado_id}. Correcta: ${es_correcta}`);
      res.status(200).json({ mensaje: 'Respuesta guardada', respuesta: result.rows[0] });

    } catch (err) {
      console.error('💥 Error al guardar la respuesta (DB QUERY FAILED):', err);
      res.status(500).json({ error: 'Error interno del servidor al guardar la respuesta', detalle: err.message });
    }
});


// NUEVA RUTA: Finalizar el ensayo y calcular el puntaje final
router.post(
  '/:resultado_id/finalizar', // La URL será /api/resultados/:resultado_id/finalizar
  verificarToken,
  authorizeRoles(['alumno', 'admin']),
  async (req, res) => {
    console.log(`--- ENTRANDO A POST /api/resultados/${req.params.resultado_id}/finalizar (ROUTE HANDLER) ---`);
    const { resultado_id } = req.params;
    const alumno_id = req.usuario.id;

    console.log(`Solicitud de finalización para Resultado ID: ${resultado_id} por Alumno ID: ${alumno_id}`);

    try {
      console.log(`Verificando resultado ID ${resultado_id} y alumno ID ${alumno_id} para finalizar.`);
      // 1. Verificar que el resultado exista y pertenezca al alumno logueado
      const resultadoCheck = await pool.query(
        'SELECT ensayo_id FROM resultados WHERE id = $1 AND alumno_id = $2',
        [resultado_id, alumno_id]
      );

      if (resultadoCheck.rows.length === 0) {
        console.warn(`❌ Acceso denegado: Resultado ID ${resultado_id} no encontrado o no pertenece a alumno ID ${alumno_id}`);
        return res.status(403).json({ error: 'Acceso denegado o resultado no encontrado' });
      }

      // 2. Calcular el puntaje total
      const puntajeResult = await pool.query(
        'SELECT COUNT(*) FROM respuestas WHERE resultado_id = $1 AND correcta = true',
        [resultado_id]
      );
      const puntaje = parseInt(puntajeResult.rows[0].count);
      console.log(`Puntaje calculado: ${puntaje} para resultado ID ${resultado_id}.`);

      // 3. Actualizar el puntaje en la tabla 'resultados'
      await pool.query(
        'UPDATE resultados SET puntaje = $1 WHERE id = $2 RETURNING *',
        [puntaje, resultado_id]
      );

      console.log(`✅ Ensayo finalizado y puntaje (${puntaje}) guardado para Resultado ID: ${resultado_id}`);
      res.status(200).json({ mensaje: 'Ensayo finalizado y puntaje guardado', puntaje });

    } catch (err) {
      console.error('💥 Error al finalizar el ensayo (DB QUERY FAILED):', err);
      res.status(500).json({ error: 'Error interno del servidor al finalizar el ensayo', detalle: err.message });
    }
});

// Obtener las preguntas para un ensayo en ejecución
router.get(
  '/:resultado_id/preguntas-ensayo', 
  verificarToken, 
  authorizeRoles(['alumno', 'admin']), 
  async (req, res) => {
    console.log(`--- ENTRANDO A GET /api/resultados/${req.params.resultado_id}/preguntas-ensayo (ROUTE HANDLER) ---`);
    const { resultado_id } = req.params; 
    const alumno_id = req.usuario.id; 

    console.log(`Solicitud para resultado ID: ${resultado_id} por alumno ID: ${alumno_id}`);

    if (!resultado_id) {
      console.warn('⚠️ Falta resultado_id en los parámetros de la URL.');
      return res.status(400).json({ error: 'Falta el ID del resultado' });
    }

    try {
      console.log(`Verificando resultado ID ${resultado_id} y alumno ID ${alumno_id} en DB.`);
      // 1. Verificar que el resultado exista y pertenezca al alumno logueado
      const resultadoCheck = await pool.query(
        'SELECT ensayo_id FROM resultados WHERE id = $1 AND alumno_id = $2',
        [resultado_id, alumno_id]
      );

      if (resultadoCheck.rows.length === 0) {
        console.warn(`❌ Acceso denegado: Resultado ID ${resultado_id} no encontrado o no pertenece a alumno ID ${alumno_id}`);
        return res.status(403).json({ error: 'Acceso denegado o resultado no encontrado' });
      }

      const ensayo_id = resultadoCheck.rows[0].ensayo_id;
      console.log(`Ensayo ID ${ensayo_id} asociado a resultado ID ${resultado_id}. Obteniendo detalles del ensayo.`);

      // 2. Obtener los detalles del ensayo
      const ensayoDetails = await pool.query(
        'SELECT id, nombre AS titulo, fecha_creacion, docente_id, materia_id FROM ensayos WHERE id = $1', 
        [ensayo_id]
      );

      if (ensayoDetails.rows.length === 0) {
        console.warn(`❌ Ensayo ID ${ensayo_id} no encontrado para el resultado ${resultado_id}.`);
        return res.status(404).json({ error: 'Ensayo asociado no encontrado' });
      }
      const ensayo = ensayoDetails.rows[0];
      console.log(`Detalles del ensayo obtenidos: ${JSON.stringify(ensayo)}`);
      console.log('Obteniendo preguntas asociadas al ensayo.');

      // 3. Obtener las preguntas asociadas a este ensayo y sus opciones
      const preguntasRaw = await pool.query(`
        SELECT
            p.id AS pregunta_id,
            p.enunciado AS texto, 
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
      console.log(`Preguntas raw obtenidas: ${preguntasRaw.rows.length} preguntas.`);

      // 4. Formatear las preguntas para que el frontend las entienda fácilmente
      const preguntasFormateadas = preguntasRaw.rows.map(row => {
        const opciones = [];
        if (row.opcion_a) opciones.push({ id: 'A', texto: row.opcion_a });
        if (row.opcion_b) opciones.push({ id: 'B', texto: row.opcion_b });
        if (row.opcion_c) opciones.push({ id: 'C', texto: row.opcion_c });
        if (row.opcion_d) opciones.push({ id: 'D', texto: row.opcion_d });

        return {
          id: row.pregunta_id,
          texto: row.texto, 
          tipo: 'multiple-choice', 
          opciones: opciones
        };
      });
      console.log('Preguntas formateadas.');

      // Recuperar respuestas previas si el usuario ya ha respondido
      console.log('Recuperando respuestas previas para el resultado.');
      const respuestasPreviasRaw = await pool.query(
          'SELECT pregunta_id, respuesta_dada FROM respuestas WHERE resultado_id = $1', 
          [resultado_id]
      );
      const respuestasPrevias = respuestasPreviasRaw.rows.reduce((acc, row) => {
          acc[row.pregunta_id] = row.respuesta_dada; 
          return acc;
      }, {});
      console.log(`Respuestas previas recuperadas: ${Object.keys(respuestasPrevias).length} respuestas.`);


      console.log(`✅ Preguntas obtenidas para Ensayo ID ${ensayo_id}, Resultado ID ${resultado_id}. Total: ${preguntasFormateadas.length} preguntas.`);
      res.status(200).json({
        ensayo: ensayo,
        preguntas: preguntasFormateadas,
        respuestasPrevias: respuestasPrevias
      });

    } catch (err) {
      console.error('💥 Error en GET /api/resultados/:resultado_id/preguntas-ensayo (DB QUERY FAILED):', err);
      res.status(500).json({ error: 'Error del servidor al obtener preguntas del ensayo', detalle: err.message });
    }
});


// Ver todos los resultados de un alumno (solo los suyos)
router.get('/ver-resultados', verificarToken, authorizeRoles(['alumno', 'admin']), async (req, res) => {
    console.log('--- ENTRANDO A GET /api/resultados/ver-resultados (ROUTE HANDLER ALUMNO) ---');
    const alumno_id = req.usuario.id; 
    console.log(`Solicitud de ver resultados para alumno ID: ${alumno_id}`);

    if (!alumno_id) {
        console.warn('⚠️ Falta alumno_id para ver resultados (no en el token).');
        return res.status(400).json({ error: 'Falta el alumno_id' });
    }

    try {
        console.log(`Consultando resultados de la base de datos para alumno ID: ${alumno_id}`);
        // Incluir el conteo de preguntas del ensayo para el cálculo "correctas/totales"
        const result = await pool.query(`
            SELECT 
                r.id AS resultado_id, 
                e.nombre AS ensayo_nombre, 
                m.nombre AS materia_nombre,
                r.puntaje, 
                r.fecha AS fecha,
                (SELECT COUNT(*) FROM ensayo_pregunta ep WHERE ep.ensayo_id = e.id) AS total_preguntas
            FROM resultados r
            JOIN ensayos e ON r.ensayo_id = e.id
            JOIN materias m ON e.materia_id = m.id
            WHERE r.alumno_id = $1
            ORDER BY r.fecha DESC 
        `, [alumno_id]);
        console.log(`✅ Resultados obtenidos para alumno ID: ${alumno_id}. Cantidad: ${result.rows.length}`);
        res.json(result.rows);
    } catch (err) {
        console.error('💥 Error al obtener los resultados:', err);
        res.status(500).json({ error: 'Error al obtener los resultados', detalle: err.message });
    }
});

// NUEVA RUTA: Ver resultados para docentes (todos o filtrados)
router.get('/ver-resultados-docente', verificarToken, authorizeRoles(['docente', 'admin']), async (req, res) => {
    console.log('--- ENTRANDO A GET /api/resultados/ver-resultados-docente (ROUTE HANDLER DOCENTE) ---');
    const { alumno_id, ensayo_id, materia_id } = req.query; // Parámetros de filtro opcionales
    const docente_solicitante_id = req.usuario.id; // ID del docente o admin que hace la solicitud

    let baseQuery = `
        SELECT 
            r.id AS resultado_id, 
            e.nombre AS ensayo_nombre, 
            m.nombre AS materia_nombre,
            u.nombre AS alumno_nombre, -- Nombre del alumno
            u.correo AS alumno_correo, -- Correo del alumno
            r.puntaje, 
            r.fecha,
            (SELECT COUNT(*) FROM ensayo_pregunta ep WHERE ep.ensayo_id = e.id) AS total_preguntas
        FROM resultados r
        JOIN ensayos e ON r.ensayo_id = e.id
        JOIN materias m ON e.materia_id = m.id
        JOIN usuarios u ON r.alumno_id = u.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    console.log(`Solicitud de resultados para docentes. Filtros: Alumno=${alumno_id}, Ensayo=${ensayo_id}, Materia=${materia_id}`);

    if (alumno_id) {
        conditions.push(`r.alumno_id = $${paramIndex++}`);
        values.push(alumno_id);
    }
    if (ensayo_id) {
        conditions.push(`r.ensayo_id = $${paramIndex++}`);
        values.push(ensayo_id);
    }
    if (materia_id) {
        conditions.push(`m.id = $${paramIndex++}`); // Filtrar por ID de materia
        values.push(materia_id);
    }
    
    // CAMBIO CLAVE AQUÍ: Se ELIMINA/COMENTA la restricción para docentes
    // para que puedan ver resultados de TODOS los ensayos, no solo los suyos.
    /*
    if (req.usuario.rol === 'docente') {
        conditions.push(`e.docente_id = $${paramIndex++}`);
        values.push(docente_solicitante_id);
    }
    */

    if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ' ORDER BY r.fecha DESC, u.nombre ASC'; // Ordenar por fecha y luego por nombre de alumno

    try {
        const result = await pool.query(baseQuery, values);
        console.log(`✅ Resultados obtenidos para docentes. Cantidad: ${result.rows.length}`);
        res.json(result.rows);
    } catch (err) {
        console.error('💥 Error al obtener los resultados para docentes:', err);
        res.status(500).json({ error: 'Error al obtener los resultados', detalle: err.message });
    }
});


// Ver detalle de un resultado específico
router.get('/ver-detalle-resultado', verificarToken, authorizeRoles(['alumno', 'docente', 'admin']), async (req, res) => {
    console.log('--- ENTRANDO A GET /api/resultados/ver-detalle-resultado (ROUTE HANDLER) ---');
    const resultado_id = req.query.resultado_id; // Se usa req.query para parámetros de consulta, no params
    const usuario_id = req.usuario.id; // El ID del usuario que solicita el detalle
    const usuario_rol = req.usuario.rol; // Rol del usuario que solicita el detalle

    console.log(`Solicitud de ver detalle de resultado para resultado ID: ${resultado_id} por Usuario ID: ${usuario_id}, Rol: ${usuario_rol}`);

    if (!resultado_id) {
        console.warn('⚠️ Falta resultado_id para ver detalle.');
        return res.status(400).json({ error: 'Falta el resultado_id' });
    }

    try {
        // Validación de autorización:
        // - Si es alumno, debe ser su propio resultado.
        // - Si es docente, ahora podrá ver cualquier resultado.
        // - Si es admin, puede ver cualquier resultado.

        let verificacionQuery;
        let verificacionValues;

        if (usuario_rol === 'alumno') {
            // Un alumno solo puede ver su propio resultado
            verificacionQuery = 'SELECT ensayo_id FROM resultados WHERE id = $1 AND alumno_id = $2';
            verificacionValues = [resultado_id, usuario_id];
        } else if (usuario_rol === 'docente' || usuario_rol === 'admin') {
            // UNIFICADO: Docentes y admins pueden ver cualquier detalle de resultado
            // Ya no se filtra por el docente_id del ensayo aquí.
            verificacionQuery = 'SELECT ensayo_id FROM resultados WHERE id = $1';
            verificacionValues = [resultado_id];
        } 
        // No hay 'else' para otros roles ya que authorizeRoles ya filtra quién puede llegar aquí.

        const verificacion = await pool.query(verificacionQuery, verificacionValues);

        if (verificacion.rows.length === 0) {
            console.warn(`❌ Acceso denegado a detalle de resultado. Resultado ID: ${resultado_id}, Usuario ID: ${usuario_id}, Rol: ${usuario_rol}`);
            return res.status(403).json({ error: 'Acceso denegado: Este resultado no te pertenece o no tienes permiso para verlo.' });
        }
        console.log('Propiedad del resultado verificada. Obteniendo detalle de preguntas.');

        const result = await pool.query(`
            SELECT
                p.id AS pregunta_id,
                p.enunciado AS texto, 
                p.opcion_a AS opcion_a, 
                p.opcion_b AS opcion_b,
                p.opcion_c AS opcion_c,
                p.opcion_d AS opcion_d,
                p.respuesta_correcta AS respuesta_correcta_id, 
                r.respuesta_dada AS respuesta_dada_id, 
                r.correcta 
            FROM respuestas r 
            JOIN preguntas p ON r.pregunta_id = p.id
            WHERE r.resultado_id = $1
            ORDER BY p.id
        `, [resultado_id]);
        console.log(`✅ Detalle de resultado obtenido para resultado ID: ${resultado_id}. Cantidad de preguntas: ${result.rows.length}`);
        res.json(result.rows);
    } catch (err) {
        console.error('💥 Error al obtener detalle del resultado (DB QUERY FAILED):', err);
        res.status(500).json({ error: 'Error al obtener detalle del resultado', detalle: err.message });
    }
});

module.exports = router;
