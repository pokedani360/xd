const jwt = require('jsonwebtoken');

// Obtener la clave secreta desde las variables de entorno
// Usar un valor por defecto si no está definida (solo para desarrollo, NUNCA en producción)
const SECRET = process.env.JWT_SECRET || 'supersecreto'; 

// Middleware para verificar el token JWT
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        console.warn('⚠️ Token no proporcionado (verificarToken)');
        return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1]; // Espera "Bearer TOKEN"
    if (!token) {
        console.warn('⚠️ Formato de token inválido (verificarToken)');
        return res.status(401).json({ error: 'Acceso denegado: Formato de token inválido' });
    }

    try {
        // --- Logs de depuración adicionales ---
        console.log('--- Verificando token en verificarToken ---');
        console.log('Token recibido:', token ? token.substring(0, 30) + '...' : 'N/A'); // Solo muestra los primeros 30 caracteres
        console.log('Clave secreta (SECRET) utilizada:', SECRET);
        // --- Fin Logs de depuración ---

        const decoded = jwt.verify(token, SECRET);
        req.usuario = decoded; // Guarda el payload decodificado en req.usuario
        // --- Log para depuración ---
        console.log('✅ Token verificado. Payload decodificado:', req.usuario);
        console.log('Rol del usuario en token:', req.usuario.rol);
        // --- Fin Log ---
        next();
    } catch (err) {
        console.error('💥 Error al verificar token (verificarToken):', err.message);
        // Nota: Un 'JsonWebTokenError: invalid signature' indica que la clave secreta no coincide.
        // Un 'TokenExpiredError: jwt expired' indica que el token ha caducado.
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
}

module.exports = verificarToken; // Exporta directamente la función
