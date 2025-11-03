import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from './services/axiosConfig';

// --- Funciones de utilidad (sin cambios) ---
function getParam(name) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name);
}

function getTempToken() {
  return (
    getParam('temp_token') ||
    getParam('tempToken') ||
    getParam('temp') ||
    getParam('token') ||
    localStorage.getItem('onboarding_temp_token') ||
    ''
  );
}

// ========================================================================
// --- PASO 1: Selección de Rol (Tu UI original) ---
// ========================================================================
function StepRole({ name, email, picture, rol, setRol, onSubmit, loading, error }) {
  return (
    <>
      <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
        {picture ? (
          <img
            src={picture}
            alt="avatar"
            referrerPolicy="no-referrer"
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : null}
        <h2 style={{ margin: 0 }}>¡Bienvenido{name ? `, ${name}` : ''}!</h2>
        {email ? <p style={{ margin: 0, opacity: 0.8 }}>{email}</p> : null}
        <p style={{ marginTop: 8, opacity: 0.8, textAlign: 'center' }}>
          Elige tu rol para completar tu perfil.
        </p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <div style={styles.roleBox}>
          <label style={styles.radio}>
            <input
              type="radio"
              name="rol"
              value="alumno"
              checked={rol === 'alumno'}
              onChange={(e) => setRol(e.target.value)}
            />
            Alumno
          </label>
          <label style={styles.radio}>
            <input
              type="radio"
              name="rol"
              value="docente"
              checked={rol === 'docente'}
              onChange={(e) => setRol(e.target.value)}
            />
            Profesor
          </label>
        </div>

        <button type="submit" disabled={loading} style={styles.primaryBtn}>
          {loading ? 'Guardando…' : 'Continuar'}
        </button>
      </form>

      {error ? <div style={styles.error}>{error}</div> : null}
    </>
  );
}

// ========================================================================
// --- PASO 2: Selección de Colegio (Corregido) ---
// ========================================================================
function StepColegio({ onColegioSelected }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  // Estado para el formulario de creación
  const [createNombre, setCreateNombre] = useState('');
  const [createComuna, setCreateComuna] = useState('');
  const [isLoadingCreate, setIsLoadingCreate] = useState(false);
  
  // Estado para el error de duplicado (409)
  const [apiError, setApiError] = useState(null); // { message: '', suggestions: [] }

  // Búsqueda con debounce (retraso para no llamar a la API en cada tecla)
  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    setIsLoadingSearch(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(`/api/colegios?query=${query}`);
        
        // --- CORRECCIÓN 1: FIX BUSCADOR ---
        // Hacemos el manejo de la respuesta más robusto.
        // Acepta si la API devuelve { colegios: [...] } o [...] directamente.
        const colegiosData = data.colegios || data;
        setResults(Array.isArray(colegiosData) ? colegiosData : []);
        // --- FIN CORRECCIÓN 1 ---

      } catch (err) {
        console.error('Error buscando colegios', err);
        setResults([]);
      } finally {
        setIsLoadingSearch(false);
      }
    }, 500); // 500ms de debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Handler para crear el colegio
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createNombre) return;

    setIsLoadingCreate(true);
    setApiError(null);

    try {
      // (Esta parte estaba bien, la dejamos igual)
      const { data } = await axiosInstance.post('/api/colegios', {
        nombre: createNombre,
        comuna: createComuna || null,
      });
      const nuevoColegio = data.colegio || data;
      if (!nuevoColegio || !nuevoColegio.id) {
        throw new Error("La API no devolvió un objeto de colegio válido");
      }
      onColegioSelected(nuevoColegio);
      
    } catch (err) {
      console.error('Error al crear colegio', err.response);
      
      // --- CORRECCIÓN 2: MEJORA MANEJO 409 ---
      if (err.response && err.response.status === 409) {
        const suggestions = err.response.data?.sugerencias; // (data.sugerencias)

        // Escenario A: 1 sugerencia clara -> la seleccionamos y avanzamos
        if (suggestions && suggestions.length === 1) {
          onColegioSelected(suggestions[0]);
          return; // ¡No mostramos error, solo avanzamos!
        }
        
        // Escenario B: Múltiples sugerencias -> las mostramos
        if (suggestions && suggestions.length > 0) {
          setApiError({
            message: `"${createNombre}" es muy similar a otros. ¿Quisiste decir:`,
            suggestions: suggestions,
          });
        } else {
        // Escenario C: 409 sin sugerencias (duplicado exacto)
          setApiError({
            message: `El colegio "${createNombre}" ya existe. Búscalo en la lista de arriba.`,
            suggestions: [],
          });
        }
        
      } else {
        // Otro error
        setApiError({
          message: err.response?.data?.error || 'Error al crear el colegio.',
          suggestions: [],
        });
      }
      // --- FIN CORRECCIÓN 2 ---
      
    } finally {
      setIsLoadingCreate(false);
    }
  };

  return (
    // ... (El JSX de <StepColegio> no necesita cambios) ...
    // El return (HTML/JSX) de StepColegio se mantiene idéntico al anterior
    <>
      <h2 style={{ margin: 0, textAlign: 'center' }}>Selecciona tu Colegio</h2>
      <p style={{ margin: '8px 0 16px', opacity: 0.8, textAlign: 'center' }}>
        Busca tu colegio o créalo si no aparece en la lista.
      </p>

      {/* --- Buscador --- */}
      <div style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="search-colegio">Buscar colegio</label>
        <input
          id="search-colegio"
          type="text"
          placeholder="Ej: Colegio María..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.input}
        />
        {isLoadingSearch && <small>Buscando...</small>}
      </div>

      {/* --- Resultados de Búsqueda --- */}
      {results.length > 0 && (
        <div style={styles.resultsList}>
          {results.map((colegio) => (
            <button
              key={colegio.id}
              type="button"
              onClick={() => onColegioSelected(colegio)}
              style={styles.resultItem}
            >
              <strong>{colegio.nombre}</strong>
              {colegio.comuna && <small>, {colegio.comuna}</small>}
            </button>
          ))}
        </div>
      )}

      {/* --- Separador --- */}
      <div style={styles.separator}>
        <span>O créalo tú mismo</span>
      </div>

      {/* --- Formulario de Creación --- */}
      <form onSubmit={handleCreate} style={{ display: 'grid', gap: 12 }}>
        <input
          type="text"
          placeholder="Nombre del nuevo colegio"
          value={createNombre}
          onChange={(e) => setCreateNombre(e.target.value)}
          style={styles.input}
          required
        />
        <input
          type="text"
          placeholder="Comuna (Opcional)"
          value={createComuna}
          onChange={(e) => setCreateComuna(e.target.value)}
          style={styles.input}
        />
        <button type="submit" disabled={isLoadingCreate} style={styles.primaryBtn}>
          {isLoadingCreate ? 'Creando...' : 'Crear y Continuar'}
        </button>
      </form>

      {/* --- MANEJO DE ERROR 409 (NORMALIZACIÓN) --- */}
      {apiError && (
        <div style={styles.error}>
          <strong>{apiError.message}</strong>
          {apiError.suggestions.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: 0, fontWeight: 500 }}>¿Quisiste decir uno de estos?</p>
              <div style={styles.suggestionsList}>
                {apiError.suggestions.map((colegio) => (
                  <button
                    key={colegio.id}
                    type="button"
                    onClick={() => onColegioSelected(colegio)}
                    style={styles.suggestionItem}
                  >
                    <strong>{colegio.nombre}</strong>
                    {colegio.comuna && <small>, {colegio.comuna}</small>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ========================================================================
// --- PASO 3: Selección de Curso (Actualizado con Lógica de Roles) ---
// ========================================================================
function StepCurso({ colegio, rol, onCursoSelected, onBack }) {
  const [cursos, setCursos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Estado para creación de curso (solo usado por docentes)
  const [createNombre, setCreateNombre] = useState('');
  const [createAnio, setCreateAnio] = useState(new Date().getFullYear());
  const [createSeccion, setCreateSeccion] = useState('');
  const [isLoadingCreate, setIsLoadingCreate] = useState(false);

  // Cargar cursos del colegio seleccionado (sin cambios)
  useEffect(() => {
    const fetchCursos = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data } = await axiosInstance.get(`/api/cursos?colegioId=${colegio.id}`);
        // Asumimos que la API devuelve { cursos: [...] } o [...]
        const cursosData = data.cursos || data;
        setCursos(Array.isArray(cursosData) ? cursosData : []);
      } catch (err) {
        console.error('Error cargando cursos', err);
        setError('No se pudieron cargar los cursos de este colegio.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCursos();
  }, [colegio.id]);

  // Handler para unirse a un curso existente (sin cambios)
  const handleJoin = async (cursoId) => {
    setIsLoading(true); // Bloquea toda la UI
    setError('');
    try {
      await axiosInstance.post(`/api/cursos/${cursoId}/unirse`);
      const cursoUnido = cursos.find(c => c.id === cursoId) || { id: cursoId, nombre: 'Curso' };
      onCursoSelected(cursoUnido);
    } catch (err) {
      console.error('Error al unirse al curso', err);
      if (err.response?.status === 409) {
        setError('Ya perteneces a este curso.');
      } else {
        setError('Error al unirse al curso.');
      }
      setIsLoading(false); // Desbloquea si hay error
    }
  };

  // Handler para crear un curso nuevo (sin cambios, solo lo llamará el docente)
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createNombre || !createAnio) return;

    setIsLoadingCreate(true);
    setError('');
    try {
      const { data } = await axiosInstance.post('/api/cursos', {
        colegioId: colegio.id,
        nombre: createNombre,
        anio: parseInt(createAnio, 10),
        seccion: createSeccion || null,
      });
      const nuevoCurso = data.curso || data;
      if (!nuevoCurso || !nuevoCurso.id) {
         throw new Error("La API no devolvió un objeto de curso válido");
      }
      onCursoSelected(nuevoCurso); // Pasa el curso creado al padre
    } catch (err) {
      console.error('Error al crear curso', err);
      if (err.response?.status === 409) {
        setError('Ya existe un curso con esas características.');
      } else {
        setError('Error al crear el curso.');
      }
    } finally {
      setIsLoadingCreate(false);
    }
  };

  // --- RENDERIZADO LÓGICO ---

  return (
    <>
      <button type="button" onClick={onBack} style={styles.linkBtn}>
        &larr; Volver a seleccionar colegio
      </button>
      <h2 style={{ margin: '16px 0 0', textAlign: 'center' }}>
        Elige tu Curso en: <br />
        <span style={{ fontWeight: 600, opacity: 0.9 }}>{colegio.nombre}</span>
      </h2>

      {isLoading && <p style={{textAlign: 'center'}}>Cargando cursos...</p>}
      {error && <div style={styles.error}>{error}</div>}

      {/* --- Sección "Unirse a Curso" (Visible para TODOS) --- */}
      {!isLoading && (
        <>
          <h3 style={styles.subHeader}>Únete a un curso existente</h3>
          {cursos.length > 0 ? (
            <div style={styles.resultsList}>
              {cursos.map((curso) => (
                <button
                  key={curso.id}
                  type="button"
                  onClick={() => handleJoin(curso.id)}
                  style={styles.resultItem}
                  disabled={isLoading} // Deshabilita mientras se une
                >
                  <strong>{curso.nombre}</strong>
                  <small> ({curso.anio} {curso.seccion || ''})</small>
                </button>
              ))}
            </div>
          ) : (
            // No hay cursos. Mostramos un mensaje diferente por rol.
            <div style={styles.infoBox}>
              {rol === 'alumno'
                ? 'Aún no hay cursos creados para este colegio. Pídele a tu profesor(a) que cree uno y podrás unirte.'
                : 'No hay cursos creados para este colegio. ¡Crea el primero!'}
            </div>
          )}
        </>
      )}

      {/* --- Sección "Crear Curso" (Visible SÓLO para DOCENTE) --- */}
      {rol === 'docente' && (
        <>
          <div style={styles.separator}>
            <span>O crea un curso nuevo</span>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'grid', gap: 12 }}>
            <input
              type="text"
              placeholder="Nombre del curso (Ej: 4to Medio A)"
              value={createNombre}
              onChange={(e) => setCreateNombre(e.target.value)}
              style={styles.input}
              required
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="number"
                placeholder="Año"
                value={createAnio}
                onChange={(e) => setCreateAnio(e.target.value)}
                style={{ ...styles.input, flex: 1 }}
                required
              />
              <input
                type="text"
                placeholder="Sección (Ej: B)"
                value={createSeccion}
                onChange={(e) => setCreateSeccion(e.target.value)}
                style={{ ...styles.input, flex: 1 }}
              />
            </div>
            <button type="submit" disabled={isLoadingCreate || isLoading} style={styles.primaryBtn}>
              {isLoadingCreate ? 'Creando...' : 'Crear y Finalizar'}
            </button>
          </form>
        </>
      )}
    </>
  );
}


// ========================================================================
// --- COMPONENTE PRINCIPAL (Controlador del Wizard) ---
// ========================================================================
export default function Onboarding({ onLogin }) {
  const navigate = useNavigate();

  // --- Estados del Wizard ---
  const [step, setStep] = useState('ROLE_SELECT'); // 'ROLE_SELECT', 'COLEGIO_SELECT', 'CURSO_SELECT'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Datos Recolectados ---
  const [rol, setRol] = useState('alumno');
  const [selectedColegio, setSelectedColegio] = useState(null);

  // --- Datos de URL (sin cambios) ---
  const name = useMemo(() => getParam('name') || '', []);
  const email = useMemo(() => getParam('email') || '', []);
  const picture = useMemo(() => getParam('picture') || '', []);
  const tempToken = useMemo(() => getTempToken(), []);

  // --- Validación del Token (sin cambios) ---
  useEffect(() => {
    if (!tempToken) {
      navigate('/login?error=missing_onboarding_token', { replace: true });
    } else {
      localStorage.setItem('onboarding_temp_token', tempToken);
    }
  }, [tempToken, navigate]);

  // --- (MODIFICADO) Handler del PASO 1: Completar Perfil y Obtener Token Final ---
  const handleSubmitRole = async (e) => {
    e.preventDefault();
    if (!tempToken) {
      setError('Falta el token temporal de onboarding.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.post(
        '/api/auth/complete-profile',
        { rol }, // 'alumno' | 'docente'
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );

      const { token, usuario } = data || {};
      if (!token || !usuario) throw new Error('Respuesta inválida del servidor');

      // --- ¡CAMBIO CLAVE! ---
      // 1. Limpia token temporal
      localStorage.removeItem('onboarding_temp_token');
      
      // 2. Guarda sesión final (axiosInstance la usará desde ahora)
      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
      
      // 3. Informa a App.js que el usuario inició sesión
      if (typeof onLogin === 'function') onLogin(usuario, token);

      // 4. Avanza al siguiente paso del wizard
      setStep('COLEGIO_SELECT');

    } catch (err) {
      console.error('[Onboarding] error', err);
      if (err?.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err?.response) {
        setError('Error desconocido: '.concat(JSON.stringify(err.response.data)));
      } else if (err?.request) {
        setError('No hubo respuesta del servidor.');
      } else {
        setError('Error inesperado: '.concat(err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // --- (NUEVO) Handler del PASO 2: Colegio Seleccionado ---
  const handleColegioSelected = (colegio) => {
    setSelectedColegio(colegio);
    setStep('CURSO_SELECT');
    setError(''); // Limpia errores del paso anterior
  };

  // --- (NUEVO) Handler del PASO 3: Curso Seleccionado (FIN) ---
  const handleCursoSelected = (curso) => {
    // El wizard terminó. Navegamos al Dashboard.
    navigate('/', { replace: true });
  };

  // --- (NUEVO) Renderizado condicional de Pasos ---
  const renderStep = () => {
    switch (step) {
      case 'COLEGIO_SELECT':
        return (
          <StepColegio
            onColegioSelected={handleColegioSelected}
          />
        );
      case 'CURSO_SELECT':
        return (
          <StepCurso
            colegio={selectedColegio}
            rol={rol} // Pasamos el rol seleccionado en el paso 1
            onCursoSelected={handleCursoSelected}
            onBack={() => {
              setStep('COLEGIO_SELECT');
              setSelectedColegio(null);
            }} // Permite volver
          />
        );
      case 'ROLE_SELECT':
      default:
        return (
          <StepRole
            name={name}
            email={email}
            picture={picture}
            rol={rol}
            setRol={setRol}
            onSubmit={handleSubmitRole}
            loading={loading}
            error={error}
          />
        );
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        
        {/* Renderiza el paso actual */}
        {renderStep()}

        {/* Botón de "Cancelar" solo visible en el primer paso */}
        {step === 'ROLE_SELECT' && (
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            style={styles.linkBtn}
          >
            ¿No eres tú? Volver al inicio de sesión
          </button>
        )}
      </div>
    </div>
  );
}

// ========================================================================
// --- Estilos (Añadí algunos para los nuevos componentes) ---
// ========================================================================
const styles = {
  // ... (Estilos wrapper, card, roleBox, radio, primaryBtn, linkBtn, error - sin cambios) ...
wrapper: {
    minHeight: '100svh',
    display: 'grid',
    placeItems: 'center',
    background: '#f6f7fb',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#fff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
  roleBox: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    border: '1px solid #dadde5',
    borderRadius: 10,
    padding: '10px 12px',
  },
  radio: { display: 'flex', alignItems: 'center', gap: 6 },
  primaryBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#111827',
    color: '#fff',
  },
  linkBtn: {
    marginTop: 10,
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    fontSize: 14,
  },
  error: {
    marginTop: 12,
    color: '#b91c1c',
    background: '#fee2e2',
    border: '1px solid #fecaca',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 14,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    borderRadius: 10,
    border: '1px solid #dadde5',
    boxSizing: 'border-box',
  },
  separator: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    margin: '20px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  resultsList: {
    maxHeight: 200,
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    marginTop: 8,
  },
  resultItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    border: 'none',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
  },
  suggestionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 8,
  },
  suggestionItem: {
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '6px 8px',
    cursor: 'pointer',
    textAlign: 'left'
  },
  demoOnlyLabel: { // (Este ya no se usa, pero no molesta dejarlo)
    background: '#fef3c7',
    color: '#92400e',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 14,
    textAlign: 'center',
    margin: 0,
  },
  
  // --- (NUEVOS ESTILOS) ---
  subHeader: {
    margin: '16px 0 8px',
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
  },
  infoBox: {
    background: '#f3f4f6', // Gris claro
    color: '#374151', // Gris oscuro
    padding: '10px 12px',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  }
};