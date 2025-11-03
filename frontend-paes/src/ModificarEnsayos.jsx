import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from './services/axiosConfig'; // Asegurate de que esta ruta sea correcta
import './ModificarEnsayos.css'; // Archivo CSS para este componente

// ==================================================================
// --- Helpers de Fechas ---
// ==================================================================

/**
 * Convierte un string UTC (de la DB) a un formato YYYY-MM-DDTHH:mm
 * compatible con el input <datetime-local>.
 */
function fromUtcToLocalInput(utcString) {
  if (!utcString) return '';
  try {
    const d = new Date(utcString);
    // Resta el offset de la zona horaria para mostrar la hora local correcta
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  } catch (e) {
    console.error("Error parsing UTC date", e);
    return '';
  }
}

/**
 * Convierte un string de <datetime-local> (YYYY-MM-DDTHH:mm) a un
 * string ISO UTC (Z) para enviar a la base de datos.
 */
function toUtcIsoString(localString) {
  if (!localString) return null;
  try {
    return new Date(localString).toISOString();
  } catch (e) {
    console.error("Error creating UTC date", e);
    return null;
  }
}

/**
 * Parsea la respuesta de /api/mi/cursos para obtener una lista limpia.
 */
function parseCursos(apiData) {
 if (!Array.isArray(apiData)) return [];
 
 return apiData
  .map(item => {
   const curso = item.curso || item;
   return {
    ...curso,
    id: curso.curso_id || curso.id,
   };
  })
  .filter(c => c && c.id && c.nombre)
  .map(c => {
      // --- LA CORRECCIÓN CLAVE ESTÁ AQUÍ ---
      // Buscamos el nombre del colegio en 'colegio_nombre' (si la API hizo JOIN)
      // o en 'colegio.nombre' (si la API anidó el objeto)
      const nombreColegio = c.colegio_nombre || c.colegio?.nombre || 'N/A';
      // --- FIN DE LA CORRECCIÓN ---

      return {
        id: c.id,
        nombre: c.nombre,
        anio: c.anio,
        seccion: c.seccion,
        nombreCompleto: `${c.nombre} ${c.seccion || ''} (${c.anio || 'Sin año'}) - (Colegio: ${nombreColegio})`
      };
    });
}


// ==================================================================
// --- Componente Principal ---
// ==================================================================
const ModificarEnsayos = ({ usuario }) => {
  const [ensayos, setEnsayos] = useState([]);
  const [selectedEnsayo, setSelectedEnsayo] = useState(null); // { ensayo: {...}, preguntas: [...] }
  const [nombreEnsayoEdit, setNombreEnsayoEdit] = useState('');
  const [materiaEnsayoEdit, setMateriaEnsayoEdit] = useState('');
  const [materias, setMaterias] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [questionToAdd, setQuestionToAdd] = useState('');
  const [materiaFilterForAdd, setMateriaFilterForAdd] = useState('');
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- NUEVOS ESTADOS para Disponibilidad y Ventanas ---
  const [editDisponibilidad, setEditDisponibilidad] = useState('permanente');
  const [editMaxIntentos, setEditMaxIntentos] = useState(0);
  const [ventanas, setVentanas] = useState([]); // Ventanas del ensayo seleccionado
  const [cursos, setCursos] = useState([]); // Cursos del docente
  
  // Objeto de la ventana a editar, o `true` si se esta creando una nueva
  const [editingVentana, setEditingVentana] = useState(null); 

  const clearMessages = () => {
    setError('');
    setMensajeExito('');
  };

  // 1. Cargar todos los ensayos del docente
  const fetchEnsayos = async () => {
    setIsLoading(true);
    clearMessages();
    try {
      const res = await axiosInstance.get('/api/ensayos/listar-todos');
      const filteredEnsayos = usuario.rol === 'docente' 
        ? res.data.filter(e => e.docente_id === usuario.id)
        : res.data;
      setEnsayos(filteredEnsayos);
    } catch (err) {
      console.error('Error al cargar ensayos:', err);
      setError(err.response?.data?.error || 'Error al cargar los ensayos.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Cargar materias Y cursos del docente
  const fetchMateriasYCursos = async () => {
    try {
      const [resMaterias, resCursos] = await Promise.all([
        axiosInstance.get('/api/materias'),
        axiosInstance.get('/api/mi/cursos') // Cursos del docente
      ]);
      setMaterias(resMaterias.data || []);
      setCursos(parseCursos(resCursos.data || []));
    } catch (err) {
      console.error('Error al cargar materias o cursos:', err);
      // No es fatal para la carga inicial de ensayos
    }
  };

  // Efecto inicial para cargar ensayos, materias y cursos
  useEffect(() => {
    fetchEnsayos();
    fetchMateriasYCursos();
  }, [usuario]);

  // 3. Cargar detalles (preguntas Y ventanas) al seleccionar un ensayo
  const handleSelectEnsayo = async (ensayoId) => {
    clearMessages();
    setIsLoading(true);
    setVentanas([]); // Limpiar ventanas anteriores
    try {
      // Ambas llamadas en paralelo
      const [resDetalles, resVentanas] = await Promise.all([
        axiosInstance.get(`/api/ensayos/${ensayoId}/preguntas`),
        axiosInstance.get(`/api/ensayos/${ensayoId}/ventanas`) // NUEVA LLAMADA
      ]);
      
      setSelectedEnsayo(resDetalles.data); 
      setNombreEnsayoEdit(resDetalles.data.ensayo.nombre);
      setMateriaEnsayoEdit(resDetalles.data.ensayo.materia_id);
      setMateriaFilterForAdd(resDetalles.data.ensayo.materia_id);
      setQuestionToAdd('');

      // NUEVO: Settear estados de disponibilidad y ventanas
      setEditDisponibilidad(resDetalles.data.ensayo.disponibilidad || 'permanente');
      setEditMaxIntentos(resDetalles.data.ensayo.max_intentos || 0);
      setVentanas(Array.isArray(resVentanas.data) ? resVentanas.data : []);

    } catch (err) {
      console.error('Error al cargar detalles del ensayo o ventanas:', err);
      setError(err.response?.data?.error || 'Error al cargar los detalles del ensayo.');
      setSelectedEnsayo(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Efecto para cargar preguntas disponibles (sin cambios)
  useEffect(() => {
    const fetchAvailableQuestions = async () => {
      if (selectedEnsayo && materiaFilterForAdd) {
        // (Esta logica no necesita cambios)
        setIsLoading(true);
        try {
          const questionsRes = await axiosInstance.get(`/api/preguntas/?materia_id=${materiaFilterForAdd}`);
          const currentEnsayoQuestionIds = new Set(selectedEnsayo.preguntas.map(q => q.pregunta_id || q.id)); // Acepta ambos formatos
          const filteredAvailable = questionsRes.data.filter(q => !currentEnsayoQuestionIds.has(q.id));
          setAvailableQuestions(filteredAvailable);
        } catch (err) {
          console.error('Error al cargar preguntas disponibles:', err);
          setError('Error al cargar preguntas disponibles para anadir.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setAvailableQuestions([]);
      }
    };

    fetchAvailableQuestions();
  }, [selectedEnsayo, materiaFilterForAdd]);

  // 5. Actualizar Ajustes Generales del Ensayo (Nombre, Materia, Disponibilidad, Intentos)
  const handleUpdateEnsayo = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!selectedEnsayo) return;

    setIsLoading(true);
    try {
      // (CORREGIDO: Payload ahora incluye disponibilidad e intentos)
      const payload = {
        nombre: nombreEnsayoEdit,
        materia_id: Number(materiaEnsayoEdit),
        disponibilidad: editDisponibilidad,
        max_intentos: Number(editMaxIntentos) > 0 ? Number(editMaxIntentos) : null
      };
      
      const res = await axiosInstance.put(`/api/ensayos/${selectedEnsayo.ensayo.id}`, payload);
      setMensajeExito('Ajustes del ensayo actualizados con exito!');
      
      // Actualizar la lista principal (para reflejar cambios de nombre/materia)
      fetchEnsayos(); 
      
      // Actualizar el estado local
      setSelectedEnsayo(prev => ({
          ...prev,
          ensayo: res.data.ensayo || res.data // Asume que el backend devuelve el ensayo actualizado
      }));
      // Sincronizar los inputs (por si el backend modifico algo)
      setNombreEnsayoEdit(res.data.ensayo?.nombre || nombreEnsayoEdit);
      setMateriaEnsayoEdit(res.data.ensayo?.materia_id || materiaEnsayoEdit);
      setEditDisponibilidad(res.data.ensayo?.disponibilidad || editDisponibilidad);
      setEditMaxIntentos(res.data.ensayo?.max_intentos || editMaxIntentos);

    } catch (err) {
      console.error('Error al actualizar ensayo:', err);
      setError(err.response?.data?.error || 'Error al actualizar el ensayo.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Eliminar un ensayo (sin cambios)
  const handleDeleteEnsayo = async (ensayoId) => {
    clearMessages();
    if (window.confirm('¿Estas seguro de que deseas eliminar este ensayo? Esta accion es irreversible.')) {
      setIsLoading(true);
      try {
        await axiosInstance.delete(`/api/ensayos/${ensayoId}`);
        setMensajeExito('Ensayo eliminado con exito!');
        setSelectedEnsayo(null);
        fetchEnsayos();
      } catch (err) {
        console.error('Error al eliminar ensayo:', err);
        setError(err.response?.data?.error || 'Error al eliminar el ensayo.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 7. Anadir pregunta a un ensayo (sin cambios)
  const handleAddQuestionToEnsayo = async () => {
    clearMessages();
    if (!selectedEnsayo || !questionToAdd) {
      setError('Por favor, selecciona una pregunta para anadir.');
      return;
    }
    setIsLoading(true);
    try {
      await axiosInstance.post(`/api/ensayos/${selectedEnsayo.ensayo.id}/preguntas/${questionToAdd}`);
      setMensajeExito('Pregunta anadida al ensayo!');
      setQuestionToAdd('');
      // Recargar todo (incluye preguntas disponibles)
      handleSelectEnsayo(selectedEnsayo.ensayo.id); 
    } catch (err) {
      console.error('Error al anadir pregunta:', err);
      setError(err.response?.data?.error || 'Error al anadir la pregunta.');
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Eliminar pregunta de un ensayo (sin cambios)
  const handleRemoveQuestionFromEnsayo = async (preguntaId) => {
    clearMessages();
    if (!selectedEnsayo || !preguntaId) return;

    if (window.confirm('¿Estas seguro de que deseas eliminar esta pregunta del ensayo?')) {
      setIsLoading(true);
      try {
        await axiosInstance.delete(`/api/ensayos/${selectedEnsayo.ensayo.id}/preguntas/${preguntaId}`);
        setMensajeExito('Pregunta eliminada del ensayo!');
        // Recargar todo
        handleSelectEnsayo(selectedEnsayo.ensayo.id); 
      } catch (err) {
        console.error('Error al eliminar pregunta:', err);
        setError(err.response?.data?.error || 'Error al eliminar la pregunta.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // --- (NUEVO) 9. Guardar (Crear o Actualizar) una Ventana ---
  const handleSaveVentana = async (ventanaData) => {
    clearMessages();
    setIsLoading(true);
    const { id, curso_id, inicio, duracion_min } = ventanaData;
    const ensayoId = selectedEnsayo.ensayo.id;

    try {
      if (id) {
        // --- Actualizar (PUT) ---
        // (Asegurate de que tu backend soporta PUT /api/ventanas/:id)
        await axiosInstance.put(`/api/ventanas/${id}`, {
          curso_id,
          inicio,
          duracion_min
        });
        setMensajeExito('Ventana actualizada con exito.');
      } else {
        // --- Crear (POST) ---
        // (Tu backend soporta POST /api/ensayos/:id/ventanas)
        await axiosInstance.post(`/api/ensayos/${ensayoId}/ventanas`, {
          curso_id,
          inicio,
          duracion_min
        });
        setMensajeExito('Nueva ventana creada con exito.');
      }
      
      // Recargar la lista de ventanas para este ensayo
      const resVentanas = await axiosInstance.get(`/api/ensayos/${ensayoId}/ventanas`);
      setVentanas(Array.isArray(resVentanas.data) ? resVentanas.data : []);
      setEditingVentana(null); // Cerrar el modal

    } catch (err) {
      console.error('Error al guardar ventana:', err);
      // El error se mostrara dentro del modal
      throw err; // Lanza el error para que el modal lo maneje
    } finally {
      setIsLoading(false);
    }
  };

  // --- (NUEVO) 10. Eliminar una Ventana ---
  const handleDeleteVentana = async (ventanaId) => {
    clearMessages();
    if (window.confirm('¿Estas seguro de que deseas eliminar esta ventana de rendicion?')) {
      setIsLoading(true);
      try {
        // (Asegurate de que tu backend soporta DELETE /api/ventanas/:id)
        await axiosInstance.delete(`/api/ventanas/${ventanaId}`);
        setMensajeExito('Ventana eliminada con exito.');
        // Recargar la lista de ventanas
        setVentanas(prev => prev.filter(v => v.id !== ventanaId));
      } catch (err) {
        console.error('Error al eliminar ventana:', err);
        setError(err.response?.data?.error || 'Error al eliminar la ventana.');
      } finally {
        setIsLoading(false);
      }
    }
  };


  return (
    <div className="modificar-ensayos-container">
      <h2>🛠 Modificar Ensayos</h2>

      {isLoading && <p className="loading-message">Cargando...</p>}
      {error && <p className="error-message">{error}</p>}
      {mensajeExito && <p className="success-message">{mensajeExito}</p>}

      {/* Lista de Ensayos Existentes (sin cambios) */}
      {!selectedEnsayo && (
        <div className="ensayos-list-section">
          <h3>Selecciona un Ensayo para Modificar:</h3>
          {ensayos.length > 0 ? (
            <ul className="ensayos-list">
              {ensayos.map((ensayo) => (
                <li key={ensayo.id} className="ensayo-item">
                  <span>{ensayo.nombre} ({ensayo.nombre_materia})</span>
                  <div className="ensayo-actions">
                    <button className="btn-editar" onClick={() => handleSelectEnsayo(ensayo.id)}>
                      Ver/Editar
                    </button>
                    <button className="btn-eliminar" onClick={() => handleDeleteEnsayo(ensayo.id)}>
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay ensayos disponibles para modificar. Crea uno primero.</p>
          )}
        </div>
      )}

      {/* Formulario de Modificacion de Ensayo */}
      {selectedEnsayo && (
        <div className="ensayo-edit-form">
          <h3>Modificando Ensayo: {selectedEnsayo.ensayo.nombre}</h3> 
          <button className="btn-back" onClick={() => setSelectedEnsayo(null)}>
            ← Volver a la lista
          </button>

          {/* --- Formulario de Ajustes Generales (MODIFICADO) --- */}
          <form onSubmit={handleUpdateEnsayo} className="edit-details-form edit-section">
            <fieldset>
              <legend>Ajustes Generales del Ensayo</legend>
              <label>
                Nombre del Ensayo:
                <input
                  type="text"
                  value={nombreEnsayoEdit}
                  onChange={(e) => setNombreEnsayoEdit(e.target.value)}
                  required
                />
              </label>
              <label>
                Materia:
                <select
                  value={materiaEnsayoEdit}
                  onChange={(e) => setMateriaEnsayoEdit(parseInt(e.target.value) || '')}
                  required
                >
                  <option value="">Selecciona una materia</option>
                  {materias.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </label>

              {/* --- NUEVO: Disponibilidad --- */}
              <div className="form-group">
                <label>Disponibilidad:</label>
                <div className="radio-group">
                  <label>
                    <input 
                      type="radio" 
                      value="permanente" 
                      checked={editDisponibilidad === 'permanente'} 
                      onChange={(e) => setEditDisponibilidad(e.target.value)}
                    />
                    Permanente
                  </label>
                  <label>
                    <input 
                      type="radio" 
                      value="ventana" 
                      checked={editDisponibilidad === 'ventana'} 
                      onChange={(e) => setEditDisponibilidad(e.target.value)}
                    />
                    Por Ventana
                  </label>
                </div>
              </div>

              {/* --- NUEVO: Max Intentos --- */}
              <label>
                Maximo de Intentos (0 o vacio = ilimitado):
                <input
                  type="number"
                  min="0"
                  value={editMaxIntentos || 0}
                  onChange={(e) => setEditMaxIntentos(Number(e.target.value))}
                  className="input-small"
                />
              </label>

              <button type="submit" className="btn-guardar-cambios">
                Guardar Cambios del Ensayo
              </button>
            </fieldset>
          </form>


          {/* --- (NUEVO) Seccion de Gestion de Ventanas --- */}
          {editDisponibilidad === 'ventana' && (
            <div className="ventana-management-section edit-section">
              <fieldset>
                <legend>Gestion de Ventanas</legend>
                {ventanas.length > 0 ? (
                  <ul className="ventanas-list">
                    {ventanas.map(v => {
                      const curso = cursos.find(c => c.id === v.curso_id);
                      return (
                        <li key={v.id} className="ventana-item">
                          <div>
                            <strong>Curso:</strong> {curso?.nombreCompleto || `ID ${v.curso_id}`}
                            <br/>
                            <strong>Inicio:</strong> {new Date(v.inicio).toLocaleString()}
                            <br/>
                            <strong>Fin:</strong> {new Date(v.fin).toLocaleString()}
                            ({v.duracion_min} min)
                          </div>
                          <div className="ventana-actions">
                            <button className="btn-editar-ventana" onClick={() => setEditingVentana(v)}>Editar</button>
                            <button className="btn-eliminar-ventana" onClick={() => handleDeleteVentana(v.id)}>Eliminar</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>Este ensayo no tiene ventanas de rendicion. ¡Crea la primera!</p>
                )}
                <button className="btn-crear-ventana" onClick={() => setEditingVentana(true)}>
                  + Crear Nueva Ventana
                </button>
              </fieldset>
            </div>
          )}


          {/* Preguntas actuales del ensayo (sin cambios) */}
          <div className="current-questions-section edit-section">
            <fieldset>
              <legend>Preguntas del Ensayo</legend>
              <h4>Preguntas actuales:</h4>
              {selectedEnsayo.preguntas && selectedEnsayo.preguntas.length > 0 ? (
                <ul className="current-questions-list">
                  {selectedEnsayo.preguntas.map((p) => (
                    <li key={p.pregunta_id || p.id}>
                      <span>{p.enunciado}</span>
                      <button 
                        className="btn-remove-question" 
                        onClick={() => handleRemoveQuestionFromEnsayo(p.pregunta_id || p.id)}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Este ensayo no tiene preguntas asociadas aun.</p>
              )}
            </fieldset>
          </div>

          {/* Anadir nuevas preguntas (sin cambios) */}
          <div className="add-question-section edit-section">
            <fieldset>
              <legend>Anadir Preguntas Existentes</legend>
              <select
                value={materiaFilterForAdd}
                onChange={(e) => setMateriaFilterForAdd(parseInt(e.target.value) || '')}
                className="select-materia-add"
              >
                <option value="">Filtrar por materia...</option>
                {materias.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>

              {availableQuestions.length > 0 ? (
                <>
                  <select
                    value={questionToAdd}
                    onChange={(e) => setQuestionToAdd(parseInt(e.target.value) || '')}
                    className="select-question-add"
                  >
                    <option value="">Selecciona una pregunta</option>
                    {availableQuestions.map((q) => (
                      <option key={q.id} value={q.id}>{q.enunciado.substring(0, 100)}...</option>
                    ))}
                  </select>
                  <button 
                    className="btn-add-question" 
                    onClick={handleAddQuestionToEnsayo}
                    disabled={!questionToAdd}
                  >
                    Anadir Pregunta
                  </button>
                </>
              ) : (
                <p>No hay preguntas disponibles para anadir con el filtro actual.</p>
              )}
            </fieldset>
          </div>
        </div>
      )}

      {/* --- (NUEVO) Modal para Crear/Editar Ventana --- */}
      {editingVentana && (
        <VentanaEditModal
          // Si editingVentana es 'true', es modo "Crear" (pasamos null)
          // Si es un objeto, es modo "Editar" (pasamos el objeto)
          ventana={editingVentana === true ? null : editingVentana}
          ensayoId={selectedEnsayo.ensayo.id}
          cursos={cursos}
          onClose={() => setEditingVentana(null)}
          onSave={handleSaveVentana}
        />
      )}
    </div>
  );
};

// ==================================================================
// --- Componente Modal para Ventanas ---
// ==================================================================
const VentanaEditModal = ({ ventana, ensayoId, cursos, onClose, onSave }) => {
  const [cursoId, setCursoId] = useState('');
  const [inicioLocal, setInicioLocal] = useState('');
  const [duracionMin, setDuracionMin] = useState(120);
  const [modalError, setModalError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = useMemo(() => ventana && ventana.id, [ventana]);

  // Poblar el formulario si estamos en modo "Editar"
  useEffect(() => {
    if (isEditMode) {
      setCursoId(ventana.curso_id || '');
      setInicioLocal(fromUtcToLocalInput(ventana.inicio));
      setDuracionMin(ventana.duracion_min || 120);
    } else {
      // Modo "Crear", resetea los campos
      setCursoId('');
      setInicioLocal('');
      setDuracionMin(120);
    }
  }, [ventana, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    
    if (!cursoId || !inicioLocal || !duracionMin) {
      setModalError('Todos los campos son obligatorios.');
      return;
    }

    const inicioUtc = toUtcIsoString(inicioLocal);
    if (!inicioUtc) {
      setModalError('La fecha de inicio es invalida.');
      return;
    }

    const payload = {
      id: isEditMode ? ventana.id : null,
      curso_id: Number(cursoId),
      inicio: inicioUtc,
      duracion_min: Number(duracionMin)
    };

    setIsSaving(true);
    try {
      await onSave(payload); // Llama a la funcion del padre (handleSaveVentana)
    } catch (err) {
      setModalError(err.response?.data?.error || err.message || 'Error al guardar la ventana.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h3>{isEditMode ? 'Editar Ventana' : 'Crear Nueva Ventana'}</h3>

        <form onSubmit={handleSubmit} className="ventana-edit-form">
          {modalError && <p className="error-message">{modalError}</p>}
          
          <label>
            Curso:
            <select 
              value={cursoId} 
              onChange={(e) => setCursoId(e.target.value)} 
              required
            >
              <option value="">Selecciona un curso</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombreCompleto}</option>
              ))}
            </select>
          </label>

          <label>
            Inicio (Fecha y Hora Local):
            <input 
              type="datetime-local"
              value={inicioLocal}
              onChange={(e) => setInicioLocal(e.target.value)}
              required
            />
          </label>

          <label>
            Duracion (minutos):
            <input 
              type="number"
              min="1"
              value={duracionMin}
              onChange={(e) => setDuracionMin(e.target.value)}
              required
              className="input-small"
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-cancelar" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn-guardar-cambios" disabled={isSaving}>
              {isSaving ? 'Guardando...' : (isEditMode ? 'Actualizar Ventana' : 'Crear Ventana')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


export default ModificarEnsayos;