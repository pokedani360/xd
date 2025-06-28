import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Si tienes un archivo CSS global
import App from './App'; // Importa tu componente App
import { BrowserRouter } from 'react-router-dom'; // <-- ¡Asegúrate de que esta línea esté presente!

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* ¡BrowserRouter debe estar aquí, envolviendo <App />! */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);