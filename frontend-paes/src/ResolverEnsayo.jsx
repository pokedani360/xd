// src/ResolverEnsayo.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from './services/axiosConfig';
import { useParams, useNavigate } from 'react-router-dom';
import './ResolverEnsayo.css';

const ResolverEnsayo = () => {
  const { resultado_id } = useParams();
  const navigate = useNavigate();

  const [ensayo, setEnsayo] = useState(null);
  const [preguntas, setPreguntas] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [respuestasSeleccionadas, setRespuestasSeleccionadas] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [timeLeft, setTimeLeft] = useState(3600);
  const timerRef = useRef(null);

  // Normaliza preguntas a un formato común { id, texto, opciones:[{id,texto}] }
  const normalizePreguntas = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((q, idx) => {
      const texto = q.texto ?? q.enunciado ?? `Pregunta ${idx + 1}`;
      let opciones = q.opciones;
      if (!Array.isArray(opciones)) {
        const candidatas = [
          ['A', q.opcion_a ?? q.a],
          ['B', q.opcion_b ?? q.b],
          ['C', q.opcion_c ?? q.c],
          ['D', q.opcion_d ?? q.d],
        ].filter(([, v]) => v != null);
        opciones = candidatas.map(([id, texto]) => ({ id, texto }));
      }
      return {
        id: q.id ?? q.pregunta_id ?? idx,
        texto,
        opciones,
      };
    });
  }, []);

  useEffect(() => {
    const fetchEnsayoAndPreguntas = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axiosInstance.get(`/api/resultados/${resultado_id}/preguntas-ensayo`);
        const { ensayo: fetchedEnsayo, preguntas: fetchedPreguntas, respuestasPrevias = {} } = response.data;

        const norm = normalizePreguntas(fetchedPreguntas || []);
        setEnsayo(fetchedEnsayo);
        setPreguntas(norm);
        setRespuestasSeleccionadas(respuestasPrevias || {});
        setCurrentQuestionIndex(0);
      } catch (err) {
        console.error('💥 Error al cargar preguntas:', err);
        if (err.response) {
          setError(`Error: ${err.response.status} - ${err.response.data.message || err.response.data.error || 'Error desconocido'}`);
        } else if (err.request) {
          setError('Error de red: no se pudo conectar al servidor.');
        } else {
          setError(`Error inesperado: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEnsayoAndPreguntas();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resultado_id, normalizePreguntas]);

  // Finalizar (memoizado para reglas de dependencias)
  const handleFinalizarEnsayo = useCallback(async (auto = false) => {
    if (!auto) {
      const ok = window.confirm('¿Finalizar el ensayo? No podrás cambiar respuestas.');
      if (!ok) return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const resp = await axiosInstance.post(`/api/resultados/${resultado_id}/finalizar`, {});
      console.log('Finalizado:', resp.data);
      navigate('/', { replace: true });
      try { sessionStorage.setItem('ventanaUsada', '1'); } catch {}
    } catch (err) {
      console.error('Error al finalizar el ensayo:', err);
      alert('Error al finalizar el ensayo. Intenta nuevamente.');
    }
  }, [resultado_id, navigate]);

  // Inicia timer solo si hay preguntas
  useEffect(() => {
    if (!loading && !error && preguntas.length > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleFinalizarEnsayo(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [loading, error, preguntas.length, handleFinalizarEnsayo]);

  // Mantiene el índice en rango si cambia la cantidad
  useEffect(() => {
    setCurrentQuestionIndex((i) => Math.min(i, Math.max(preguntas.length - 1, 0)));
  }, [preguntas.length]);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleOptionSelect = useCallback(async (preguntaId, opcionId) => {
    setRespuestasSeleccionadas((prev) => ({ ...prev, [preguntaId]: opcionId }));
    try {
      await axiosInstance.post(`/api/resultados/${resultado_id}/responder`, {
        pregunta_id: preguntaId,
        respuesta_dada: opcionId,
      });
    } catch (err) {
      console.error('Error al guardar respuesta:', err);
    }
  }, [resultado_id]);

  

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((i) => (i < preguntas.length - 1 ? i + 1 : i));
  }, [preguntas.length]);

  const handlePreviousQuestion = useCallback(() => {
    setCurrentQuestionIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const jumpToQuestion = useCallback((idx) => {
    if (idx >= 0 && idx < preguntas.length) {
      setCurrentQuestionIndex(idx);
    }
  }, [preguntas.length]);

  // Hotkeys ← →
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') handleNextQuestion();
      if (e.key === 'ArrowLeft') handlePreviousQuestion();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextQuestion, handlePreviousQuestion]);

  if (loading) {
    return <div className="container"><p className="message">Cargando ensayo...</p></div>;
  }

  if (error) {
    return (
      <div className="container">
        <p className="message error-message">{error}</p>
        <button onClick={() => navigate('/')} className="nav-button" style={{ marginTop: 16 }}>Volver</button>
      </div>
    );
  }

  if (!ensayo || preguntas.length === 0) {
    return (
      <div className="container">
        <p className="message">Este ensayo no tiene preguntas asignadas.</p>
        <button onClick={() => navigate('/')} className="nav-button" style={{ marginTop: 16 }}>Volver</button>
      </div>
    );
  }

  const currentQuestion = preguntas[currentQuestionIndex];
  const isSingle = preguntas.length === 1; // eslint-disable-line no-unused-vars
  const titulo = ensayo.titulo ?? ensayo.nombre ?? 'Ensayo';

  return (
    <div className="container">
      <h2 className="title">Ensayo: {titulo}</h2>

      <div className="timer-container">
        Tiempo restante: <span className="timer-display">{formatTime(timeLeft)}</span>
      </div>

      <div className="question-container">
        <p className="question-counter">Pregunta {currentQuestionIndex + 1} de {preguntas.length}</p>
        <h3 className="question-text">{currentQuestion.texto}</h3>

        <div className="options-container">
          {currentQuestion.opciones?.map((opcion) => (
            <label key={opcion.id} className="option-label">
              <input
                type="radio"
                name={`question-${currentQuestion.id}`}
                value={opcion.id}
                checked={respuestasSeleccionadas[currentQuestion.id] === opcion.id}
                onChange={() => handleOptionSelect(currentQuestion.id, opcion.id)}
                className="radio-input"
              />
              {opcion.texto}
            </label>
          ))}
        </div>

        {/* Navegación */}
        <div className="navigation-buttons">
          {isSingle ? (
            <button onClick={() => handleFinalizarEnsayo(false)} className="finalizar-button">
              Finalizar Ensayo
            </button>
          ) : (
            <>
              <button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}
                      className={`nav-button ${currentQuestionIndex === 0 ? 'nav-button-disabled' : ''}`}>
                Anterior
              </button>
              <button onClick={handleNextQuestion} disabled={currentQuestionIndex === preguntas.length - 1}
                      className={`nav-button ${currentQuestionIndex === preguntas.length - 1 ? 'nav-button-disabled' : ''}`}>
                Siguiente
              </button>

              {currentQuestionIndex === preguntas.length - 1 && (
                <button onClick={() => handleFinalizarEnsayo(false)} className="finalizar-button">
                  Finalizar Ensayo
                </button>
              )}
            </>
          )}
        </div>

        {/* Paginador de puntos */}
        <div className="dots-paginator">
          {preguntas.map((q, idx) => {
            const active = idx === currentQuestionIndex;
            const answered = respuestasSeleccionadas[q.id] != null;
            return (
              <button
                key={idx}
                className={`dot ${active ? 'dot-active' : ''} ${answered ? 'dot-answered' : ''}`}
                aria-label={`Ir a la pregunta ${idx + 1}`}
                onClick={() => jumpToQuestion(idx)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ResolverEnsayo;