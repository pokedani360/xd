import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios'; // Usamos axios directamente ya que axiosInstance puede tener un baseURL, pero si quieres usarlo, ajusta la importación.
import { useParams, useNavigate } from 'react-router-dom'; // ¡CORRECCIÓN AQUÍ! Faltaba 'from'

import './ResolverEnsayo.css'; 

const ResolverEnsayo = () => {
  const { resultado_id } = useParams(); // Captura el ID del resultado de la URL
  const navigate = useNavigate(); // Hook para la navegación programática

  const [ensayo, setEnsayo] = useState(null); // Almacena los detalles del ensayo
  const [preguntas, setPreguntas] = useState([]); // Almacena la lista de preguntas
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Índice de la pregunta actual
  const [respuestasSeleccionadas, setRespuestasSeleccionadas] = useState({}); // Respuestas seleccionadas por el alumno
  const [loading, setLoading] = useState(true); // Estado de carga
  const [error, setError] = useState(null); // Estado para errores
  
  // --- Estados para el temporizador ---
  // Puedes ajustar la duración inicial aquí (en segundos). Ejemplo: 1 hora = 3600 segundos
  const [timeLeft, setTimeLeft] = useState(3600); 
  const timerRef = useRef(null); // Referencia para el intervalo del temporizador, para poder limpiarlo

  // useEffect para cargar las preguntas y los detalles del ensayo
  useEffect(() => {
    const fetchEnsayoAndPreguntas = async () => {
      try {
        setLoading(true); // Inicia la carga
        setError(null);    // Limpia errores
        console.log('Resolviendo ensayo para resultado_id:', resultado_id);
        
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No hay token de autenticación. Por favor, inicia sesión.');
        }

        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };

        // Realiza la solicitud GET a tu backend para obtener las preguntas del ensayo
        // Apunta a tu gateway que enruta a /api/resultados/:resultado_id/preguntas-ensayo
        const response = await axios.get(`http://localhost:80/api/resultados/${resultado_id}/preguntas-ensayo`, config);
        
        console.log('Respuesta de la API de preguntas:', response.data);
        const { ensayo: fetchedEnsayo, preguntas: fetchedPreguntas, respuestasPrevias = {} } = response.data;

        setEnsayo(fetchedEnsayo);
        setPreguntas(fetchedPreguntas);
        setRespuestasSeleccionadas(respuestasPrevias);

        // Opcional: Si tu ensayo tiene una duración definida en el backend,
        // la podrías usar aquí para inicializar el timer.
        // Por ejemplo: if (fetchedEnsayo.duracion_segundos) setTimeLeft(fetchedEnsayo.duracion_segundos);

      } catch (err) {
        console.error('💥 Error al cargar el ensayo o las preguntas en ResolverEnsayo:', err);
        if (err.response) {
          setError(`Error: ${err.response.status} - ${err.response.data.message || err.response.data.error || 'Error desconocido del servidor'}`);
        } else if (err.request) {
          setError('Error de red: No se pudo conectar al servidor. Asegúrate de que el backend esté funcionando.');
        } else {
          setError(`Error inesperado: ${err.message}`);
        }
      } finally {
        setLoading(false); // Finaliza la carga
        console.log('Estado de carga finalizado.');
      }
    };

    fetchEnsayoAndPreguntas();

    // Limpia el temporizador si el componente se desmonta o el resultado_id cambia
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [resultado_id]); // Dependencia: Se ejecuta cuando `resultado_id` cambia (al cargar el componente por primera vez)

  // --- useEffect para el temporizador (se inicia una vez que las preguntas se cargan) ---
  useEffect(() => {
    // Solo inicia el timer si los datos se cargaron y hay preguntas
    if (!loading && !error && preguntas.length > 0) { 
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current); // Detiene el temporizador
            // Finalizar ensayo automáticamente si el tiempo se acaba
            handleFinalizarEnsayo(true); // `true` indica que es un final automático
            return 0;
          }
          return prevTime - 1; // Decrementa el tiempo
        });
      }, 1000); // Actualiza cada segundo (1000 ms)

      // Función de limpieza para detener el temporizador cuando el componente se desmonte
      return () => clearInterval(timerRef.current);
    }
  }, [loading, preguntas.length]); // Dependencias: Se activa cuando la carga termina o el número de preguntas cambia

  // Función para formatear el tiempo restante en HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Maneja la selección de una opción de respuesta y la envía al backend
  const handleOptionSelect = async (preguntaId, opcionId) => {
    // Actualiza el estado local de respuestas seleccionadas
    setRespuestasSeleccionadas(prevRespuestas => ({
      ...prevRespuestas,
      [preguntaId]: opcionId,
    }));

    try {
      const token = localStorage.getItem('token');
      if (!token) return; // No hace nada si no hay token (debería ser manejado por la redirección de login)

      // Envía la respuesta al backend. Apunta a tu gateway.
      await axios.post(
        `http://localhost:80/api/resultados/${resultado_id}/responder`,
        {
          pregunta_id: preguntaId,
          respuesta_dada: opcionId, // Aquí se envía 'A', 'B', 'C', 'D'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`Respuesta para pregunta ${preguntaId} guardada: ${opcionId}`);
    } catch (err) {
      console.error('Error al guardar respuesta:', err);
      // Aquí podrías mostrar un mensaje temporal al usuario si la respuesta no se guarda
    }
  };

  // Navega a la siguiente pregunta
  const handleNextQuestion = () => {
    if (currentQuestionIndex < preguntas.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    }
  };

  // Navega a la pregunta anterior
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
    }
  };

  // Función para finalizar el ensayo, con un parámetro para indicar si es automático
  const handleFinalizarEnsayo = async (autoFinalizar = false) => {
    // Si no es una finalización automática, pide confirmación al usuario
    if (!autoFinalizar) {
      const confirmar = window.confirm('¿Estás seguro de que deseas finalizar el ensayo? No podrás cambiar tus respuestas.');
      if (!confirmar) return; // Si el usuario cancela, no hace nada
    }

    // Detener el temporizador si está corriendo
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return; // No hace nada si no hay token

      // Envía la solicitud para finalizar el ensayo al backend. Apunta a tu gateway.
      const response = await axios.post(
        `http://localhost:80/api/resultados/${resultado_id}/finalizar`,
        {}, // Cuerpo de la solicitud vacío ya que el ID está en la URL
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Ensayo finalizado. Redirigiendo a resultados:', response.data);
      // Redirige a la vista de resultados específicos de este ensayo
      navigate(`/resultados/${resultado_id}`); 
    } catch (err) {
      console.error('Error al finalizar el ensayo:', err);
      alert('Error al finalizar el ensayo. Intenta nuevamente.'); // Alerta de error (considera reemplazar por UI)
    }
  };

  // --- Renderizado Condicional: Mensajes de estado ---
  if (loading) {
    return (
      <div className="container">
        <p className="message">Cargando ensayo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <p className="message error-message">Error: {error}</p>
        <p className="message">No se pudo cargar el ensayo. Verifica tu conexión y que el ID del ensayo sea válido.</p>
      </div>
    );
  }

  // Si no se cargó el ensayo o no tiene preguntas
  if (!ensayo || preguntas.length === 0) {
    return (
      <div className="container">
        <p className="message">No se encontró el ensayo o no tiene preguntas asignadas.</p>
        <button onClick={() => navigate('/ver-ensayos')} className="nav-button" style={{ marginTop: '20px' }}>
          Volver a Ensayos Disponibles
        </button>
      </div>
    );
  }

  // Obtiene la pregunta actual a mostrar
  const currentQuestion = preguntas[currentQuestionIndex];

  // --- Renderizado del Ensayo ---
  return (
    <div className="container">
      <h2 className="title">Ensayo: {ensayo.titulo}</h2>
      {/* <p className="description">{ensayo.descripcion}</p> <-- Si tienes campo de descripción en `ensayo` */}

      {/* --- Visualización del Temporizador --- */}
      <div className="timer-container">
        Tiempo restante: <span className="timer-display">{formatTime(timeLeft)}</span>
      </div>

      <div className="question-container">
        <p className="question-counter">
          Pregunta {currentQuestionIndex + 1} de {preguntas.length}
        </p>
        <h3 className="question-text">{currentQuestion.texto}</h3>

        <div className="options-container">
          {currentQuestion.opciones && currentQuestion.opciones.map(opcion => (
            <label key={opcion.id} className="option-label">
              <input
                type="radio"
                name={`question-${currentQuestion.id}`} // Agrupa radios por pregunta
                value={opcion.id}
                // Marca la opción si coincide con la respuesta ya seleccionada
                checked={respuestasSeleccionadas[currentQuestion.id] === opcion.id}
                onChange={() => handleOptionSelect(currentQuestion.id, opcion.id)}
                className="radio-input"
              />
              {opcion.texto}
            </label>
          ))}
        </div>

        <div className="navigation-buttons">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0} // Deshabilita si es la primera pregunta
            className={`nav-button ${currentQuestionIndex === 0 ? 'nav-button-disabled' : ''}`}
          >
            Anterior
          </button>
          <button
            onClick={handleNextQuestion}
            disabled={currentQuestionIndex === preguntas.length - 1} // Deshabilita si es la última pregunta
            className={`nav-button ${currentQuestionIndex === preguntas.length - 1 ? 'nav-button-disabled' : ''}`}
          >
            Siguiente
          </button>
          {/* Muestra el botón Finalizar solo en la última pregunta */}
          {currentQuestionIndex === preguntas.length - 1 && (
            <button
              onClick={() => handleFinalizarEnsayo(false)} // `false` para indicar que es un final manual
              className="finalizar-button"
            >
              Finalizar Ensayo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResolverEnsayo;
