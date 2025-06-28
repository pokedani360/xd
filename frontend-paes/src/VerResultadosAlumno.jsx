import React, { useEffect, useState } from 'react';
import axiosInstance from './services/axiosConfig'; // Asegúrate de que la ruta sea correcta
import './VerResultados.css'; // Importa los estilos compartidos

const VerResultadosAlumno = () => {
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detalleResultado, setDetalleResultado] = useState(null); // Para mostrar el modal de detalle
  const [modalOpen, setModalOpen] = useState(false); // Controla la visibilidad del modal

  useEffect(() => {
    const fetchResultados = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // --- LOG CRÍTICO PARA DEPURACIÓN ---
        console.log('VerResultadosAlumno: Preparando solicitud GET para /api/resultados/ver-resultados');
        // --- FIN LOG ---

        const res = await axiosInstance.get('/api/resultados/ver-resultados'); // Esta ruta obtiene los resultados del alumno logueado
        setResultados(res.data);
      } catch (err) {
        console.error('💥 Error al cargar resultados del alumno:', err);
        setError(err.response?.data?.error || 'Error al cargar tus resultados. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchResultados();
  }, []);

  const verDetalle = async (resultado_id) => {
    try {
      setError(null);
      // --- LOG CRÍTICO PARA DEPURACIÓN ---
      console.log(`VerResultadosAlumno: Preparando solicitud GET para detalle de resultado: /api/resultados/ver-detalle-resultado?resultado_id=${resultado_id}`);
      // --- FIN LOG ---
      const res = await axiosInstance.get(`/api/resultados/ver-detalle-resultado?resultado_id=${resultado_id}`);
      setDetalleResultado(res.data);
      setModalOpen(true); // Abre el modal
    } catch (err) {
      console.error('💥 Error al cargar el detalle del resultado:', err);
      setError(err.response?.data?.error || 'Error al cargar el detalle del resultado. Asegúrate de tener permisos.');
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setDetalleResultado(null); // Limpiar detalle al cerrar
  };

  if (loading) {
    return (
      <div className="resultados-container">
        <p className="no-resultados">Cargando tus resultados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resultados-container">
        <p className="no-resultados error-message">Error: {error}</p>
      </div>
    );
  }

  if (resultados.length === 0) {
    return (
      <div className="resultados-container">
        <p className="no-resultados">No has rendido ningún ensayo todavía.</p>
      </div>
    );
  }

  return (
    <div className="resultados-container">
      <h2>Mis Resultados de Ensayos</h2>
      
      <table className="tabla-resultados">
        <thead>
          <tr>
            <th>Ensayo</th>
            <th>Materia</th>
            <th>Puntaje</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((res) => (
            // CORRECCIÓN: Eliminar espacios en blanco entre <tr> y <td> para evitar errores de hidratación
            <tr key={res.resultado_id}><td>{res.ensayo_nombre}</td> {/* ¡CORREGIDO AQUÍ! */}
            <td>{res.materia_nombre}</td> {/* ¡CORREGIDO AQUÍ! */}
            <td>{res.puntaje}</td>
            <td>{new Date(res.fecha).toLocaleDateString()}</td>
            <td>
              <button onClick={() => verDetalle(res.resultado_id)}>Ver Detalle</button>
            </td></tr>
          ))}
        </tbody>
      </table>

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
                    <p>Tu Respuesta: <span className="respuesta-dada">{pregunta.respuesta_dada_id}</span></p>
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

export default VerResultadosAlumno;
