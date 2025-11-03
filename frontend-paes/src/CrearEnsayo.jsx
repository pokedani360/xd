import React, { useEffect, useState, useMemo } from 'react';
import axiosInstance from './services/axiosConfig';
import './CrearEnsayo.css';

// ==================================================================
// --- (FUNCIÓN CORREGIDA) ---
// ==================================================================
// Convierte un valor de <input type="datetime-local"> a ISO UTC
function toUtcIsoString(localDateTimeValue) {
  if (!localDateTimeValue) return null;
  
  // new Date("2025-11-02T19:13") crea un objeto de fecha en la ZONA HORARIA LOCAL del usuario.
  // .toISOString() AUTOMÁTICAMENTE convierte esa fecha local a su string equivalente en UTC.
  // Ej: "2025-11-02T19:13" (Chile, UTC-3) se convierte en "2025-11-02T22:13:00.000Z" (UTC).
  // Esto es lo que queremos.
  return new Date(localDateTimeValue).toISOString();
}
// ==================================================================
// --- (FIN DE LA CORRECCIÓN) ---
// ==================================================================


const CrearEnsayo = ({ usuario }) => {
  const [materias, setMaterias] = useState([]);
// ... (El resto del archivo no necesita cambios) ...
  const [materiaId, setMateriaId] = useState('');
  const [preguntas, setPreguntas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [preguntasSeleccionadas, setPreguntasSeleccionadas] = useState([]);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState('permanente');
  const [maxIntentos, setMaxIntentos] = useState('0');
  const [cursos, setCursos] = useState([]);
  const [cursoId, setCursoId] = useState('');
  const [inicioLocal, setInicioLocal] = useState('');
  const [duracionMin, setDuracionMin] = useState(120);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // ==================================================================
  // --- useEffect (fetchMateriasYCursos) (MODIFICADO) ---
  // ==================================================================
  useEffect(() => {
    const fetchMateriasYCursos = async () => {
      try {
        setError('');
        if (!authHeaders.Authorization) {
          setError('No hay token de autenticación. Por favor, inicia sesión.');
          return;
        }
        const config = { headers: authHeaders };
        const [resMaterias, resCursos] = await Promise.all([
          axiosInstance.get('/api/materias/', config),
          axiosInstance.get('/api/mi/cursos', config).catch(() => ({ data: [] })),
        ]);

        setMaterias(resMaterias.data || []);

        // --- (INICIO DE LA CORRECCIÓN) ---
        // Lógica de parseo robusta para /api/mi/cursos
        const cursosData = resCursos.data;
        let misCursos = [];
        
        // La API (según el log) devuelve un array plano: [{ curso_id: 1, nombre: '...' }]
        // Transformamos este array para que coincida con lo que el resto del componente espera ({ id: ..., nombre: ... })
        
        if (Array.isArray(cursosData)) {
          misCursos = cursosData
            .map(item => {
              // Si la API devuelve { curso: {...} }, lo extraemos.
              // Si no, usamos el item (que es { curso_id: ..., nombre: ... })
              const cursoObj = item.curso || item;

              // Transformamos el objeto para que tenga 'id' en lugar de 'curso_id'
              // Esto unifica el formato de los datos para el resto del componente.
              return {
                id: cursoObj.id || cursoObj.curso_id, // Acepta 'id' O 'curso_id'
                nombre: cursoObj.nombre,
                seccion: cursoObj.seccion,
                // Mapeamos 'colegio' si existe, para el nombre en el dropdown
                colegio: cursoObj.colegio 
              };
            })
            // Filtramos cualquier dato que no tenga un ID o nombre válido después de la transformación
            .filter(curso => curso && curso.id && curso.nombre); 
        
        } else {
            console.warn("La respuesta de /api/mi/cursos no fue un array:", cursosData);
        }

        // Log de depuración para ver qué cursos se cargaron
        console.log("Cursos parseados para el docente:", misCursos);
        
        // Nos aseguramos de que no haya IDs duplicados
        const cursosUnicos = Array.from(new Map(misCursos.map(c => [c.id, c])).values());
        
        setCursos(cursosUnicos);
        // --- (FIN DE LA CORRECCIÓN) ---
        
        if(cursosUnicos.length === 0) {
            console.warn("No se encontraron cursos para este docente (después del filtro) o la API devolvió un formato inesperado:", cursosData);
        }
      } catch (err) {
        console.error('Error al cargar materias/cursos:', err);
        setError(err.response?.data?.error || 'Error al cargar datos iniciales.');
      }
    };
    fetchMateriasYCursos();
  }, [authHeaders]);

  // Efecto para cargar preguntas al seleccionar materia
  useEffect(() => {
    const fetchPreguntas = async () => {
      if (materiaId) {
        try {
          setError('');
          if (!authHeaders.Authorization) {
            setError('No hay token de autenticación para cargar preguntas.');
            return;
          }
          const config = { headers: authHeaders };
          const res = await axiosInstance.get(`/api/preguntas/?materia_id=${Number(materiaId)}`, config);
          setPreguntas(res.data || []);
          setPreguntasSeleccionadas([]);
        } catch (err) {
          console.error('Error al cargar preguntas:', err);
          setError(err.response?.data?.error || 'Error al cargar las preguntas para la materia seleccionada.');
        }
      } else {
        setPreguntas([]);
        setPreguntasSeleccionadas([]);
      }
    };
    fetchPreguntas();
  }, [materiaId, authHeaders]);

  // Efecto para ocultar mensaje de éxito
  useEffect(() => {
    if (mensajeExito) {
      setIsFadingOut(false);
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        const hideTimer = setTimeout(() => {
          setMensajeExito('');
          setIsFadingOut(false);
        }, 500);
        return () => clearTimeout(hideTimer);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [mensajeExito]);

  // ==================================================================
  // --- FUNCIÓN DE CREAR ENSAYO (Ahora debería funcionar) ---
  // ==================================================================
  const crearEnsayo = async () => {
    setError('');
    setMensajeExito('');

    // 1. Validaciones de rol y campos básicos
    if (usuario?.rol !== 'docente' && usuario?.rol !== 'admin') {
      setError('Solo docentes (o admin) pueden crear ensayos.');
      return;
    }
    if (!nombre || !materiaId || preguntasSeleccionadas.length === 0) {
      setError('Por favor, completa todos los campos y selecciona al menos una pregunta.');
      return;
    }
    
    // Convertimos y validamos los IDs ANTES de usarlos
    const numCursoId = Number(cursoId);
    const numDuracionMin = Number(duracionMin);
    const numMaxIntentos = Number(maxIntentos) > 0 ? Number(maxIntentos) : null;

    // 2. Validación de "Ventana"
    if (disponibilidad === 'ventana') {
      // Esta validación ahora funcionará porque el 'value' del option será un ID numérico
      if (isNaN(numCursoId) || numCursoId <= 0) {
        console.error(`Validación fallida: numCursoId es ${numCursoId} (derivado de estado cursoId: '${cursoId}')`);
        return setError('Selecciona un curso para la ventana inicial.');
      }
      if (!inicioLocal) {
        return setError('Selecciona fecha/hora de inicio para la ventana.');
      }
      if (isNaN(numDuracionMin) || numDuracionMin <= 0) {
        return setError('Duración inválida.');
      }
    }

    try {
      if (!authHeaders.Authorization) {
        setError('No hay token de autenticación para crear el ensayo.');
        return;
      }
      const config = { headers: { ...authHeaders, 'Content-Type': 'application/json' } };

      // 3. Crear el ENSAYO
      const payloadEnsayo = {
        titulo: nombre,
        materia_id: Number(materiaId),
        preguntas: preguntasSeleccionadas.map(Number),
        disponibilidad,
        max_intentos: numMaxIntentos,
      };

      console.log('POST /api/ensayos/crear-ensayo-con-preguntas payload:', payloadEnsayo);
      const res = await axiosInstance.post('/api/ensayos/crear-ensayo-con-preguntas', payloadEnsayo, config);

      const ensayoCreado = res.data?.ensayo || {};
      const ensayoId = ensayoCreado.id || res.data?.ensayo_id;

      if (!ensayoId) {
        console.error("La API de crear ensayo no devolvió un ID", res.data);
        throw new Error("No se pudo obtener el ID del ensayo creado.");
      }

      // 4. Crear la VENTANA (si es necesario)
      if (disponibilidad === 'ventana' && ensayoId) {
        
        const inicioUtc = toUtcIsoString(inicioLocal); // <== USA LA FUNCIÓN CORREGIDA
        
        const payloadVentana = {
          curso_id: numCursoId,     // Usamos la variable ya validada
          inicio: inicioUtc,
          duracion_min: numDuracionMin, // Usamos la variable ya validada
        };
        
        const endpointVentana = `/api/ensayos/${ensayoId}/ventanas`;

        console.log(`POST ${endpointVentana} payload:`, payloadVentana);
        const resVentana = await axiosInstance.post(endpointVentana, payloadVentana, config);

        if (!resVentana || resVentana.status >= 400) {
          throw new Error('Ensayo creado, pero no se pudo crear la ventana inicial.');
        }
      }

      const ensayoNombre = ensayoCreado?.titulo || ensayoCreado?.nombre || nombre;
      setMensajeExito(
        disponibilidad === 'permanente'
          ? `Ensayo "${ensayoNombre}" creado como PERMANENTE (sin vencimiento${numMaxIntentos ? `, máx ${numMaxIntentos} intentos` : ', intentos ilimitados'}).`
          : `Ensayo "${ensayoNombre}" creado con ventana inicial asignada.`
      );

      // Reset de formulario
      setNombre('');
      setMateriaId('');
      setPreguntasSeleccionadas([]);
      setPreguntas([]);
      setDisponibilidad('permanente');
      setMaxIntentos('0');
      setCursoId('');
      setInicioLocal('');
      setDuracionMin(120);
    } catch (err) {
      console.error('Error al crear ensayo:', err);
      if (err.response) {
        setError(err.response.data?.error || `Error ${err.response.status}: ${err.response.statusText}`);
      } else if (err.request) {
        setError('No se pudo conectar con el servidor.');
      } else {
        setError(err.message || 'Error al crear el ensayo. Inténtalo de nuevo.');
      }
    }
  };

  const togglePregunta = (id) => {
    setPreguntasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // ==================================================================
  // --- RENDER (Sin cambios) ---
  // ==================================================================
  return (
    <div className="crear-ensayo-container">
      <h2>Crear Ensayo</h2>
      {error && <p className="error-message">{error}</p>}
      {mensajeExito && <p className={`success-message ${isFadingOut ? 'fade-out' : ''}`}>{mensajeExito}</p>}

      <input
        type="text"
        placeholder="Nombre del ensayo"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        className="input-nombre"
      />

      <select
        value={materiaId}
        onChange={e => setMateriaId(e.target.value)}
        className="select-materia"
      >
        <option value="">Seleccione una materia</option>
        {materias.map((m, index) => (
          <option key={m.id || index} value={m.id}>{m.nombre}</option>
        ))}
      </select>

      {materiaId && (
        <div className="preguntas-box">
          <h4>Seleccionar preguntas:</h4>
          {preguntas.length > 0 ? (
            <ul className="lista-preguntas">
              {preguntas.map(p => (
                <li key={p.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preguntasSeleccionadas.includes(p.id)}
                      onChange={() => togglePregunta(p.id)}
                    />
                    {p.enunciado}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay preguntas disponibles para esta materia o no se pudieron cargar.</p>
          )}
        </div>
      )}

      {/* Bloque de disponibilidad */}
      <fieldset className="disponibilidad-fieldset">
        <legend>Disponibilidad</legend>
        <div className="disponibilidad-row">
          <label className="disp-option">
            <input
              type="radio"
              name="disponibilidad"
              value="permanente"
              checked={disponibilidad === 'permanente'}
              onChange={() => setDisponibilidad('permanente')}
            />
            Permanente (sin vencimiento)
          </label>

          <label className="disp-option">
            <input
              type="radio"
              name="disponibilidad"
              value="ventana"
              checked={disponibilidad === 'ventana'}
              onChange={() => setDisponibilidad('ventana')}
            />
            Por ventana (fecha/hora + duración)
          </label>
        </div>

        <div className="mt-2">
          <label className="block text-sm">Máximo de intentos</label>
          <input
            type="number"
            min={0}
            className="input-small"
            value={maxIntentos}
            onChange={(e) => setMaxIntentos(e.target.value)}
          />
          <span className="input-hint">0 o vacío = ilimitado</span>
        </div>
      </fieldset>

      {/* Si es por ventana, pedir datos de la ventana inicial */}
      {disponibilidad === 'ventana' && (
        <fieldset className="ventana-fieldset">
          <legend>Ventana inicial</legend>
          <div className="ventana-grid">
            <div>
              <label>Curso</label>
              <select
                className="select-materia"
                value={cursoId}
                onChange={(e) => setCursoId(e.target.value)}
              >
                <option value="">Seleccione un curso</option>
                {/* Esta parte ahora recibirá 'cursos' con IDs válidos */}
                {cursos.length > 0 ? (
                  cursos.map((c, index) => (
                    // La 'key' usa c.id, que ahora está correctamente parseado
                    <option key={c.id || index} value={c.id}>
                      {c.nombre}{c.colegio ? ` (${c.colegio.nombre})` : ''}{c.seccion ? ` - ${c.seccion}` : ''}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No perteneces a ningún curso</option>
                )}
              </select>
            </div>

            <div>
              <label>Inicio (fecha y hora)</label>
              <input
                type="datetime-local"
                className="input-nombre"
                value={inicioLocal}
                onChange={(e) => setInicioLocal(e.target.value)}
              />
            </div>

            <div>
              <label>Duración (minutos)</label>
              <input
                type="number"
                min={1}
                className="input-small"
                value={duracionMin}
                onChange={(e) => setDuracionMin(e.target.value)}
              />
            </div>
          </div>
          <p className="input-hint">Se creará una ventana para el curso seleccionado. Puedes agregar más luego.</p>
        </fieldset>
      )}

      <button className="btn-crear" onClick={crearEnsayo}>Crear Ensayo</button>
    </div>
  );
};

export default CrearEnsayo;