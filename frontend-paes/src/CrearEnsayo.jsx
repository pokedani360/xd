import React, { useEffect, useState } from 'react';
import axiosInstance from './services/axiosConfig'; // Asegúrate de que esta ruta de importación sea correcta
import './CrearEnsayo.css'; // Asegúrate de que este archivo CSS exista

const CrearEnsayo = ({ usuario }) => {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState('');
  const [preguntas, setPreguntas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [preguntasSeleccionadas, setPreguntasSeleccionadas] = useState([]);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false); // Nuevo estado para la animación de desvanecimiento

  // Cargar materias al inicio
  useEffect(() => {
    const fetchMaterias = async () => {
      try {
        setError('');
        const token = localStorage.getItem('token');
        if (!token) {
            setError('No hay token de autenticación. Por favor, inicia sesión.');
            return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        const res = await axiosInstance.get('/api/materias/', config); 
        setMaterias(res.data);
      } catch (err) {
        console.error('Error al cargar materias:', err);
        setError(err.response?.data?.error || 'Error al cargar las materias.');
      }
    };
    fetchMaterias();
  }, []);

  // Cargar preguntas disponibles cuando cambia la materia seleccionada
  useEffect(() => {
    const fetchPreguntas = async () => {
      if (materiaId) {
        try {
          setError('');
          const token = localStorage.getItem('token');
          if (!token) {
              setError('No hay token de autenticación para cargar preguntas.');
              return;
          }
          const config = { headers: { Authorization: `Bearer ${token}` } };

          const res = await axiosInstance.get(`/api/preguntas/?materia_id=${materiaId}`, config); 
          setPreguntas(res.data);
          setPreguntasSeleccionadas([]); // Limpiar selecciones anteriores al cambiar materia
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
  }, [materiaId]); // Dependencia del efecto para recargarse cuando cambia materiaId

  // Efecto para gestionar el mensaje de éxito y su desvanecimiento
  useEffect(() => {
    if (mensajeExito) {
      setIsFadingOut(false); // Asegúrate de que no esté desvaneciéndose al aparecer
      const timer = setTimeout(() => {
        setIsFadingOut(true); // Inicia el desvanecimiento
        const hideTimer = setTimeout(() => {
          setMensajeExito(''); // Oculta el mensaje completamente
          setIsFadingOut(false); // Resetear el estado de desvanecimiento
        }, 500); // Duración de la transición de opacidad (debe coincidir con el CSS)
        return () => clearTimeout(hideTimer);
      }, 3000); // El mensaje se muestra por 3 segundos antes de empezar a desvanecerse
      return () => clearTimeout(timer);
    }
  }, [mensajeExito]);


  const crearEnsayo = async () => {
    setError('');
    setMensajeExito(''); // Limpiar el mensaje de éxito existente antes de una nueva solicitud

    if (!nombre || !materiaId || preguntasSeleccionadas.length === 0) {
      setError('Por favor, completa todos los campos y selecciona al menos una pregunta.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
          setError('No hay token de autenticación para crear el ensayo.');
          return;
      }
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const res = await axiosInstance.post('/api/ensayos/crear-ensayo-con-preguntas', {
        nombre,
        docente_id: usuario.id,
        materia_id: materiaId,
        preguntas: preguntasSeleccionadas
      }, config);
      
      setMensajeExito(`Ensayo "${res.data.ensayo.nombre}" creado con éxito.`);
      // Limpiar formulario después de éxito
      setNombre('');
      setMateriaId('');
      setPreguntasSeleccionadas([]);
      setPreguntas([]); // También limpiar preguntas disponibles para una recarga limpia
      
    } catch (err) {
      console.error('Error al crear ensayo:', err);
      setError(err.response?.data?.error || 'Error al crear el ensayo. Inténtalo de nuevo.');
    }
  };

  const togglePregunta = (id) => {
    setPreguntasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

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
        {materias.map(m => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>

      {materiaId && ( // Solo muestra la sección de preguntas si se ha seleccionado una materia
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

      <button className="btn-crear" onClick={crearEnsayo}>Crear Ensayo</button>
    </div>
  );
};

export default CrearEnsayo;
