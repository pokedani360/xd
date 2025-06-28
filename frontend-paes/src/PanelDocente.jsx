import React, { useState } from 'react';
import './PanelDocente.css';
import CrearEnsayo from './CrearEnsayo';
import BancoPreguntas from './BancoPreguntas';
import ModificarEnsayos from './ModificarEnsayos'; // Importa el nuevo componente
import VerResultadosDocente from './VerResultadosDocente';

const PanelDocente = ({ usuario, onLogout }) => {
  const [seccion, setSeccion] = useState('crear');

  return (
    <div className="panel-docente">
      <header className="panel-header">
        <h1>👨‍🏫 Panel Docente - {usuario.nombre}</h1>
        <button onClick={onLogout}>Cerrar sesión</button>
      </header>

      <nav className="panel-nav">
        <button 
          onClick={() => setSeccion('crear')} 
          className={seccion === 'crear' ? 'active' : ''}
        >
          📝 Crear Ensayo
        </button>
        <button 
          onClick={() => setSeccion('modificar')} 
          className={seccion === 'modificar' ? 'active' : ''}
        >
          🛠 Modificar Ensayos
        </button>
        <button 
          onClick={() => setSeccion('banco')} 
          className={seccion === 'banco' ? 'active' : ''}
        >
          📚 Banco de Preguntas
        </button>
        <button 
          onClick={() => setSeccion('resultados')} 
          className={seccion === 'resultados' ? 'active' : ''}
        >
          📊 Resultados de Alumnos
        </button>
      </nav>

      <main className="panel-main">
        {seccion === 'crear' && <CrearEnsayo usuario={usuario} />}
        {seccion === 'modificar' && <ModificarEnsayos usuario={usuario} />} {/* Renderiza el nuevo componente aquí */}
        {seccion === 'banco' && <BancoPreguntas usuario={usuario} />}
        {seccion === 'resultados' && <VerResultadosDocente usuario={usuario} />}
      </main>
    </div>
  );
};

export default PanelDocente;
