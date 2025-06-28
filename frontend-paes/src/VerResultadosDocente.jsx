import React, { useEffect, useState } from 'react';
import axiosInstance from './services/axiosConfig'; // Asegúrate de que la ruta sea correcta
import './VerResultados.css'; // Importa los estilos compartidos

const VerResultadosDocente = () => {
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detalleResultado, setDetalleResultado] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Estados para filtros
  const [filtroAlumnoId, setFiltroAlumnoId] = useState(''); // Estado para el ID de alumno (opcional)
  const [filtroEnsayoId, setFiltroEnsayoId] = useState(''); 
  const [filtroMateriaId, setFiltroMateriaId] = useState(''); 
  const [materias, setMaterias] = useState([]); // Para el select de materias
  const [ensayos, setEnsayos] = useState([]); // Para el select de ensayos

  // Función para cargar resultados con filtros
  const fetchResultados = async () => {
    try {
      setLoading(true);
      setError(null);

      let queryParams = {};
      // El filtro de alumno_id es opcional. Solo se añade si hay un valor en el input.
      if (filtroAlumnoId) {
        queryParams.alumno_id = filtroAlumnoId; 
      }
      if (filtroEnsayoId) {
        queryParams.ensayo_id = filtroEnsayoId; 
      }
      if (filtroMateriaId) {
        queryParams.materia_id = filtroMateriaId; 
      }
      
      const apiUrl = '/api/resultados/ver-resultados-docente';
      const queryString = new URLSearchParams(queryParams).toString();
      console.log(`VerResultadosDocente: Preparando solicitud GET para: ${apiUrl}?${queryString}`);

      const res = await axiosInstance.get(apiUrl, {
        params: queryParams,
      });
      setResultados(res.data);
    } catch (err) {
      console.error('💥 Error al cargar resultados para docentes:', err);
      setError(err.response?.data?.error || 'Error al cargar los resultados. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar materias y ensayos para los filtros al inicio
  useEffect(() => {
    const fetchFiltrosData = async () => {
      try {
        const [materiasRes, ensayosRes] = await Promise.all([
          axiosInstance.get('/api/materias/'), 
          axiosInstance.get('/api/ensayos/listar-todos'), 
        ]);
        setMaterias(materiasRes.data);
        setEnsayos(ensayosRes.data);
      } catch (err) {
        console.error('Error al cargar datos para filtros:', err);
        setError('Error al cargar opciones de filtro.');
      }
    };
    fetchFiltrosData();
    fetchResultados(); // Carga inicial de resultados (sin filtros, mostrando todos por defecto)
  }, []);

  const handleAplicarFiltros = () => {
    fetchResultados(); // Vuelve a cargar resultados con los filtros actuales
  };

  const verDetalle = async (resultado_id) => {
    try {
      setError(null);
      console.log(`VerResultadosDocente: Preparando solicitud GET para detalle de resultado: /api/resultados/ver-detalle-resultado?resultado_id=${resultado_id}`);
      const res = await axiosInstance.get(`/api/resultados/ver-detalle-resultado?resultado_id=${resultado_id}`);
      setDetalleResultado(res.data);
      setModalOpen(true);
    } catch (err) {
      console.error('💥 Error al cargar el detalle del resultado:', err);
      setError(err.response?.data?.error || 'Error al cargar el detalle del resultado. Asegúrate de tener permisos.');
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setDetalleResultado(null);
  };

  if (loading) {
    return <div className="resultados-container"><p className="no-resultados">Cargando resultados de alumnos...</p></div>;
  }

  if (error) {
    return <div className="resultados-container"><p className="no-resultados error-message">{error}</p></div>;
  }

  return (
    <div className="resultados-container">
      <h2>Resultados de Alumnos</h2>

      <div className="filtros-resultados">
        <div>
          <label htmlFor="filtroAlumno">ID Alumno:</label>
          <input
            type="text"
            id="filtroAlumno"
            value={filtroAlumnoId}
            onChange={(e) => setFiltroAlumnoId(e.target.value)}
            placeholder="Opcional: ID de alumno" // Texto para indicar que es opcional
          />
        </div>
        <div>
          <label htmlFor="filtroEnsayo">Ensayo:</label>
          <select
            id="filtroEnsayo"
            value={filtroEnsayoId}
            onChange={(e) => setFiltroEnsayoId(e.target.value)}
          >
            <option value="">Todos los Ensayos</option>
            {ensayos.map((ensayo) => (
              <option key={ensayo.id} value={ensayo.id}>
                {ensayo.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtroMateria">Materia:</label>
          <select
            id="filtroMateria"
            value={filtroMateriaId}
            onChange={(e) => setFiltroMateriaId(e.target.value)}
          >
            <option value="">Todas las Materias</option>
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.nombre}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleAplicarFiltros}>Aplicar Filtros</button>
      </div>

      {resultados.length === 0 ? (
        <p className="no-resultados">No hay resultados que coincidan con los filtros aplicados.</p>
      ) : (
        <table className="tabla-resultados">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Ensayo</th>
              <th>Materia</th>
              <th>Puntaje</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((res) => (
              <tr key={res.resultado_id}>
                <td>{res.alumno_nombre} ({res.alumno_correo})</td>
                <td>{res.ensayo_nombre}</td>
                <td>{res.materia_nombre}</td>
                <td>{res.puntaje}</td>
                <td>{new Date(res.fecha).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => verDetalle(res.resultado_id)}>Ver Detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-button" onClick={closeModal}>&times;</button>
            <h3>Detalle del Ensayo</h3>
            {detalleResultado && detalleResultado.length > 0 ? (
              <div>
                {detalleResultado.map((pregunta, index) => (
                  <div 
                    key={pregunta.pregunta_id} 
                    className={`pregunta-detalle ${pregunta.correcta ? 'correcta' : 'incorrecta'}`}
                  >
                    <p className="enunciado"><strong>{index + 1}. {pregunta.texto}</strong></p>
                    <p className="opciones">
                      <span>A) {pregunta.opcion_a}</span>
                      <span>B) {pregunta.opcion_b}</span>
                      <span>C) {pregunta.opcion_c}</span>
                      <span>D) {pregunta.opcion_d}</span>
                    </p>
                    <p>Respuesta del Alumno: <span className="respuesta-dada">{pregunta.respuesta_dada_id}</span></p>
                    <p>Respuesta Correcta: <span className="respuesta-correcta">{pregunta.respuesta_correcta_id}</span></p>
                    <p className="estado-respuesta">Estado: {pregunta.correcta ? '¡Correcta!' : 'Incorrecta'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No se pudieron cargar los detalles de este ensayo.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerResultadosDocente;
