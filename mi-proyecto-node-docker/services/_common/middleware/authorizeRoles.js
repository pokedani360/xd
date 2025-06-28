/**
 * Recibe una lista de roles permitidos y comprueba
 * que el `req.usuario.rol` (inyectado por verifyToken) esté dentro.
 *
 * Uso:
 * const authorizeRoles = require('../../_common/middleware/authorizeRoles');
 * router.post('/crear', verificarToken, authorizeRoles(['docente']), handler);
 */
module.exports = (allowedRoles) => { // allowedRoles es un array, ej: ['admin', 'docente']
  return (req, res, next) => {
    // --- Log para depuración en authorizeRoles ---
    console.log('--- Ejecutando authorizeRoles ---');
    console.log('Roles permitidos para esta ruta:', allowedRoles);
    console.log('Usuario en req.usuario (desde verifyToken):', req.usuario); // <-- Lee de req.usuario
    // --- Fin Log ---

    // Ahora verificamos req.usuario, que es donde verificarToken guarda el payload.
    // Si req.usuario o req.usuario.rol no existen, significa que el token no se decodificó bien
    // o el usuario no tiene un rol en el token.
    if (!req.usuario || !req.usuario.rol) { 
      console.warn('⚠️ Autorización fallida (middleware authorizeRoles): Usuario o rol no definido en el token.');
      return res.status(403).json({ error: 'Acceso denegado: Información de usuario no disponible en el token o token inválido.' });
    }

    // Comprobamos si el rol del usuario está incluido en la lista de roles permitidos
    if (!allowedRoles.includes(req.usuario.rol)) { 
      console.warn(`❌ Autorización fallida (middleware authorizeRoles): Rol '${req.usuario.rol}' no permitido para esta acción. Se requiere uno de: ${allowedRoles.join(', ')}.`);
      return res.status(403).json({ error: `Acceso denegado: Tu rol (${req.usuario.rol}) no tiene permisos para esta acción.` });
    }

    // Si el rol está permitido, pasa al siguiente middleware/ruta
    console.log(`✅ Autorización exitosa para rol '${req.usuario.rol}'.`);
    return next();
  };
};
