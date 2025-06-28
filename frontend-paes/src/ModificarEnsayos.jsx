import React, { useState, useEffect } from 'react';
import axiosInstance from './services/axiosConfig'; // Asegúrate de que esta ruta sea correcta
import './ModificarEnsayos.css'; // Archivo CSS para este componente

const ModificarEnsayos = ({ usuario }) => {
  const [ensayos, setEnsayos] = useState([]);
  const [selectedEnsayo, setSelectedEnsayo] = useState(null); // Contiene los detalles del ensayo Y sus preguntas
  const [nombreEnsayoEdit, setNombreEnsayoEdit] = useState('');
  const [materiaEnsayoEdit, setMateriaEnsayoEdit] = useState('');
  const [materias, setMaterias] = useState([]); // Todas las materias para el select
  const [availableQuestions, setAvailableQuestions] = useState([]); // Preguntas disponibles para añadir
  const [questionToAdd, setQuestionToAdd] = useState(''); // ID de la pregunta a añadir
  const [materiaFilterForAdd, setMateriaFilterForAdd] = useState(''); // Nuevo estado para el filtro de materia al añadir
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Para estados de carga

  // Función para limpiar mensajes de estado
  const clearMessages = () => {
    setError('');
    setMensajeExito('');
  };

  // 1. Cargar todos los ensayos del docente (o todos si es admin)
  const fetchEnsayos = async () => {
    setIsLoading(true);
    clearMessages();
    try {
      const res = await axiosInstance.get('/api/ensayos/listar-todos');
      // Filtra ensayos si el usuario es 'docente' para mostrar solo los suyos
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

  // 2. Cargar todas las materias al inicio
  const fetchMaterias = async () => {
    try {
      const res = await axiosInstance.get('/api/materias');
      setMaterias(res.data);
    } catch (err) {
      console.error('Error al cargar materias:', err);
      // No establece error global ya que las materias no son críticas para mostrar la lista inicial
    }
  };

  // Efecto inicial para cargar ensayos y materias
  useEffect(() => {
    fetchEnsayos();
    fetchMaterias();
  }, [usuario]); // Recargar si el usuario cambia (ej. logout/login)

  // 3. Cuando se selecciona un ensayo, cargar sus detalles y preguntas
  const handleSelectEnsayo = async (ensayoId) => {
    clearMessages();
    setIsLoading(true);
    try {
      // Obtener detalles del ensayo y sus preguntas asociadas
      const res = await axiosInstance.get(`/api/ensayos/${ensayoId}/preguntas`);
      
      // ¡CORRECCIÓN CRÍTICA AQUÍ!
      // Guardamos todo el objeto de respuesta del backend que contiene 'ensayo' y 'preguntas'
      setSelectedEnsayo(res.data); 
      setNombreEnsayoEdit(res.data.ensayo.nombre);
      setMateriaEnsayoEdit(res.data.ensayo.materia_id);
      setMateriaFilterForAdd(res.data.ensayo.materia_id); // Inicializa el filtro de añadir con la materia del ensayo
      setQuestionToAdd(''); // Limpiar selección

    } catch (err) {
      console.error('Error al cargar detalles del ensayo:', err);
      setError(err.response?.data?.error || 'Error al cargar los detalles del ensayo.');
      setSelectedEnsayo(null); // Deseleccionar si hay error
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Efecto para cargar preguntas disponibles para añadir
  useEffect(() => {
    const fetchAvailableQuestions = async () => {
      if (selectedEnsayo && materiaFilterForAdd) {
        setIsLoading(true);
        try {
          const questionsRes = await axiosInstance.get(`/api/preguntas/?materia_id=${materiaFilterForAdd}`);
          
          // Filtra las preguntas disponibles para que no incluyan las que ya están en el ensayo seleccionado
          const currentEnsayoQuestionIds = new Set(selectedEnsayo.preguntas.map(q => q.pregunta_id));
          const filteredAvailable = questionsRes.data.filter(q => 
              !currentEnsayoQuestionIds.has(q.id)
          );
          setAvailableQuestions(filteredAvailable);
        } catch (err) {
          console.error('Error al cargar preguntas disponibles:', err);
          setError(err.response?.data?.error || 'Error al cargar preguntas disponibles para añadir.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setAvailableQuestions([]);
      }
    };

    fetchAvailableQuestions();
  }, [selectedEnsayo, materiaFilterForAdd]); // Depende del ensayo seleccionado y del filtro de materia

  // 5. Actualizar nombre/materia del ensayo
  const handleUpdateEnsayo = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!selectedEnsayo) return;

    setIsLoading(true);
    try {
      const res = await axiosInstance.put(`/api/ensayos/${selectedEnsayo.ensayo.id}`, { // Usa selectedEnsayo.ensayo.id
        nombre: nombreEnsayoEdit,
        materia_id: materiaEnsayoEdit,
      });
      setMensajeExito('Ensayo actualizado con éxito!');
      // Actualizar la lista de ensayos en la UI
      fetchEnsayos(); 
      // Actualizar el ensayo seleccionado en el estado local
      // Aquí también se asegura de que 'preguntas' se mantenga
      setSelectedEnsayo(prev => ({
          ...prev,
          ensayo: res.data.ensayo // Solo actualiza los detalles del ensayo
      }));
    } catch (err) {
      console.error('Error al actualizar ensayo:', err);
      setError(err.response?.data?.error || 'Error al actualizar el ensayo.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Eliminar un ensayo
  const handleDeleteEnsayo = async (ensayoId) => {
    clearMessages();
    if (window.confirm('¿Estás seguro de que deseas eliminar este ensayo y todas sus preguntas asociadas? Esta acción es irreversible.')) {
      setIsLoading(true);
      try {
        await axiosInstance.delete(`/api/ensayos/${ensayoId}`);
        setMensajeExito('Ensayo eliminado con éxito!');
        setSelectedEnsayo(null); // Ocultar el formulario de edición
        fetchEnsayos(); // Recargar la lista de ensayos
      } catch (err) {
        console.error('Error al eliminar ensayo:', err);
        setError(err.response?.data?.error || 'Error al eliminar el ensayo.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 7. Añadir pregunta a un ensayo
  const handleAddQuestionToEnsayo = async () => {
    clearMessages();
    if (!selectedEnsayo || !questionToAdd) {
      setError('Por favor, selecciona una pregunta para añadir.');
      return;
    }

    setIsLoading(true);
    try {
      await axiosInstance.post(`/api/ensayos/${selectedEnsayo.ensayo.id}/preguntas/${questionToAdd}`);
      setMensajeExito('Pregunta añadida al ensayo!');
      setQuestionToAdd(''); // Limpiar selección
      // Recargar detalles del ensayo para actualizar la lista de preguntas Y las preguntas disponibles
      handleSelectEnsayo(selectedEnsayo.ensayo.id); 
    } catch (err) {
      console.error('Error al añadir pregunta:', err);
      setError(err.response?.data?.error || 'Error al añadir la pregunta al ensayo.');
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Eliminar pregunta de un ensayo
  const handleRemoveQuestionFromEnsayo = async (preguntaId) => {
    clearMessages();
    if (!selectedEnsayo || !preguntaId) return;

    if (window.confirm('¿Estás seguro de que deseas eliminar esta pregunta del ensayo?')) {
      setIsLoading(true);
      try {
        await axiosInstance.delete(`/api/ensayos/${selectedEnsayo.ensayo.id}/preguntas/${preguntaId}`);
        setMensajeExito('Pregunta eliminada del ensayo!');
        // Recargar detalles del ensayo para actualizar la lista de preguntas Y las preguntas disponibles
        handleSelectEnsayo(selectedEnsayo.ensayo.id); 
      } catch (err) {
        console.error('Error al eliminar pregunta del ensayo:', err);
        setError(err.response?.data?.error || 'Error al eliminar la pregunta del ensayo.');
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

      {/* Lista de Ensayos Existentes */}
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

      {/* Formulario de Modificación de Ensayo */}
      {selectedEnsayo && (
        <div className="ensayo-edit-form">
          {/* Usamos selectedEnsayo.ensayo.nombre para acceder al nombre del ensayo */}
          <h3>Modificando Ensayo: {selectedEnsayo.ensayo.nombre}</h3> 
          <button className="btn-back" onClick={() => setSelectedEnsayo(null)}>
            ← Volver a la lista
          </button>

          <form onSubmit={handleUpdateEnsayo} className="edit-details-form">
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
            <button type="submit" className="btn-guardar-cambios">
              Guardar Cambios del Ensayo
            </button>
          </form>

          {/* Preguntas actuales del ensayo */}
          <div className="current-questions-section">
            <h4>Preguntas actuales en este ensayo:</h4>
            {/* ¡CORRECCIÓN CRÍTICA AQUÍ! Accedemos a selectedEnsayo.preguntas */}
            {selectedEnsayo.preguntas && selectedEnsayo.preguntas.length > 0 ? (
              <ul className="current-questions-list">
                {selectedEnsayo.preguntas.map((p) => (
                  <li key={p.pregunta_id}>
                    <span>{p.enunciado}</span>
                    <button 
                      className="btn-remove-question" 
                      onClick={() => handleRemoveQuestionFromEnsayo(p.pregunta_id)}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Este ensayo no tiene preguntas asociadas aún.</p>
            )}
          </div>

          {/* Añadir nuevas preguntas */}
          <div className="add-question-section">
            <h4>Añadir Preguntas Existentes:</h4>
            {/* NUEVO FILTRO POR MATERIA PARA AÑADIR PREGUNTAS */}
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
                    <option key={q.id} value={q.id}>{q.enunciado}</option>
                  ))}
                </select>
                <button 
                  className="btn-add-question" 
                  onClick={handleAddQuestionToEnsayo}
                  disabled={!questionToAdd}
                >
                  Añadir Pregunta
                </button>
              </>
            ) : (
              <p>No hay preguntas disponibles para añadir con el filtro actual. Crea más en el "Banco de Preguntas" o ajusta el filtro.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModificarEnsayos;
