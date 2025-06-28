import React, { useEffect, useState } from 'react';
import axios from 'axios'; // Usamos axios directamente ya que axiosInstance puede tener un baseURL, pero si quieres usarlo, ajusta la importación.
import './PanelAlumno.css'; // Asegúrate de que esta ruta sea correcta
import { useNavigate } from 'react-router-dom'; // Importa useNavigate

const VerEnsayos = () => {
  const [ensayos, setEnsayos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('');
  const [loading, setLoading] = useState(true); // Estado para indicar si los datos están cargando
  const [error, setError] = useState(null);   // Estado para manejar cualquier error en la carga de datos
  const navigate = useNavigate(); // Hook para la navegación programática

  useEffect(() => {
    // Función asíncrona para obtener los datos de ensayos y materias
    const obtenerDatos = async () => {
      try {
        setLoading(true); // Inicia el estado de carga
        setError(null);    // Limpia cualquier error previo

        const token = localStorage.getItem('token'); // Obtiene el token de autenticación del almacenamiento local
        if (!token) {
          // Si no hay token, lanza un error para que sea capturado por el catch
          throw new Error('No hay token de autenticación disponible. Por favor, inicia sesión.');
        }

        // Configuración de los headers para incluir el token de autorización
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };

        // Realiza llamadas concurrentes a la API para obtener ensayos y materias
        // Promise.all espera a que todas las promesas se resuelvan
        const [ensayosRes, materiasRes] = await Promise.all([
          // URL para obtener todos los ensayos. Asegúrate de que esta URL es correcta en tu backend.
          // Por ejemplo: 'http://localhost:80/api/ensayos/listar-todos' o simplemente 'http://localhost:80/api/ensayos'
          axios.get('http://localhost:80/api/ensayos/listar-todos', config),
          // URL para obtener todas las materias. Asegúrate de que esta URL es correcta en tu backend.
          axios.get('http://localhost:80/api/materias', config),
        ]);

        const fetchedEnsayos = ensayosRes.data;   // Datos de ensayos obtenidos
        const fetchedMaterias = materiasRes.data; // Datos de materias obtenidos

        // **Paso clave: Enriquecer los ensayos con el nombre de la materia**
        // Mapea cada ensayo y le añade una nueva propiedad 'materiaNombre'
        const ensayosConNombreMateria = fetchedEnsayos.map(ensayo => {
          // Busca la materia correspondiente en la lista de materias cargadas
          const materiaCorrespondiente = fetchedMaterias.find(
            materia => materia.id === ensayo.materia_id // Compara el materia_id del ensayo con el id de la materia
          );
          return {
            ...ensayo, // Copia todas las propiedades existentes del ensayo
            // Asigna el nombre de la materia si se encuentra, de lo contrario, usa 'Materia Desconocida'
            materiaNombre: materiaCorrespondiente ? materiaCorrespondiente.nombre : 'Materia Desconocida'
          };
        });

        setEnsayos(ensayosConNombreMateria); // Actualiza el estado con los ensayos enriquecidos
        setMaterias(fetchedMaterias);       // Actualiza el estado con la lista de materias
        
      } catch (err) {
        console.error('💥 Error cargando datos en VerEnsayos:', err); // Log detallado del error
        // Manejo de errores para proporcionar feedback al usuario
        if (err.response) {
          // El servidor respondió con un código de estado fuera del rango 2xx (ej. 401, 404, 500)
          setError(`Error del servidor: ${err.response.status} - ${err.response.data.message || err.response.data.error || 'Mensaje desconocido'}`);
        } else if (err.request) {
          // La solicitud fue hecha pero no se recibió respuesta (ej. problema de red, CORS, API no accesible)
          setError('Error de red: No se pudo conectar al servidor de la API. Asegúrate de que tu backend esté corriendo.');
        } else {
          // Algo más ocurrió al configurar la solicitud (ej. error en el token)
          setError(`Error inesperado: ${err.message}`);
        }
      } finally {
        setLoading(false); // Siempre finaliza el estado de carga, independientemente del éxito o error
      }
    };

    obtenerDatos(); // Llama a la función para obtener los datos cuando el componente se monta
  }, []); // El array de dependencias vacío asegura que este efecto se ejecute solo una vez al inicio

  // Filtra los ensayos según la materia seleccionada en el dropdown
  const ensayosFiltrados = materiaSeleccionada
    ? ensayos.filter(e => e.materia_id === parseInt(materiaSeleccionada)) // Convierte el valor del select a entero para comparar
    : ensayos; // Si no hay materia seleccionada, muestra todos los ensayos

  // Función para manejar el inicio de un ensayo
  const comenzarEnsayo = async (ensayo_id) => {
    // NOTA: window.confirm() no es compatible con el entorno de Canvas de Gemini.
    // En una aplicación real, usarías un modal o componente de confirmación personalizado.
    const confirmar = window.confirm('¿Estás seguro de que deseas comenzar este ensayo?');
    if (!confirmar) return; // Si el usuario cancela, no hace nada

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Debes iniciar sesión para comenzar un ensayo.');
        return;
      }
      
      // Realiza una solicitud POST para crear un nuevo resultado de ensayo
      const res = await axios.post(
        '/api/resultados/crear-resultado', // URL del endpoint para crear resultados
        { ensayo_id }, // Envía el ID del ensayo en el cuerpo de la solicitud
        { headers: { Authorization: `Bearer ${token}` } } // Incluye el token de autorización
      );
      
      // Navega a la página de resolución del ensayo con el ID del resultado recién creado
      navigate(`/resolver/${res.data.resultado_id}`);
    } catch (error) {
      console.error('💥 Error al comenzar el ensayo:', error);
      // Muestra una alerta simple de error. Considera reemplazar por un componente de UI más amigable.
      alert('Error al crear el ensayo. Intenta nuevamente.');
    }
  };

  // Muestra un mensaje de carga mientras los datos se están obteniendo
  if (loading) {
    return (
      <div className="panel-alumno" style={{ textAlign: 'center', padding: '20px' }}>
        <h2 className="titulo-seccion">Cargando Ensayos...</h2>
        <p>Por favor, espera mientras obtenemos la lista de ensayos y materias.</p>
      </div>
    );
  }

  // Muestra un mensaje de error si algo salió mal durante la carga
  if (error) {
    return (
      <div className="panel-alumno" style={{ textAlign: 'center', padding: '20px', color: 'red' }}>
        <h2 className="titulo-seccion">Error al cargar los datos</h2>
        <p>{error}</p>
        <p>Asegúrate de que tus microservicios de backend (`/api/ensayos/listar-todos` y `/api/materias`) estén funcionando correctamente y accesibles en `http://localhost:80` (tu gateway).</p>
      </div>
    );
  }

  // Si no hay ensayos disponibles (después de la carga y sin errores)
  if (ensayos.length === 0 && !loading && !error) {
    return (
      <div className="panel-alumno" style={{ textAlign: 'center', padding: '20px' }}>
        <h2 className="titulo-seccion">Ensayos Disponibles</h2>
        <p>No hay ensayos disponibles en este momento.</p>
        <p>Verifica que haya ensayos registrados en tu base de datos y que el endpoint `/api/ensayos/listar-todos` los devuelva correctamente.</p>
      </div>
    );
  }

  // Renderiza la interfaz de usuario con la lista de ensayos
  return (
    <div className="panel-alumno">
      <h2 className="titulo-seccion">Ensayos Disponibles</h2>

      {/* Selector para filtrar ensayos por materia */}
      <div className="selector-materia">
        <label htmlFor="materia">Filtrar por materia:</label>
        <select
          id="materia"
          value={materiaSeleccionada}
          onChange={(e) => setMateriaSeleccionada(e.target.value)}
        >
          <option value="">Todas las materias</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla para mostrar los ensayos */}
      <div className="tabla-contenedor">
        <table className="tabla-ensayos">
          <thead>
            <tr>
              <th>Nombre del Ensayo</th>
              <th>Materia</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {/* Si hay ensayos filtrados, mapea y muestra cada uno */}
            {ensayosFiltrados.length > 0 ? (
              ensayosFiltrados.map((e) => (
                <tr key={e.id}>
                  <td>{e.nombre}</td>
                  {/* Muestra el nombre de la materia, que ahora está en e.materiaNombre */}
                  <td>{e.materiaNombre}</td> 
                  <td>
                    <button className="btn-comenzar" onClick={() => comenzarEnsayo(e.id)}>
                      Comenzar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                {/* Mensaje si no hay ensayos que coincidan con el filtro */}
                <td colSpan="3">No hay ensayos disponibles para la materia seleccionada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VerEnsayos;
