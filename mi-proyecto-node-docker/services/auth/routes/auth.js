/* eslint-disable no-console */
console.log('✅ auth.js fue cargado');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// === Config & helpers ===
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_ISSUER = process.env.JWT_ISSUER || 'paes-auth';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
const AUTH_PUBLIC_BASE_URL = process.env.AUTH_PUBLIC_BASE_URL || 'http://localhost';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function toBase64Url(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Buffer.from(json).toString('base64url');
}

function signAccessToken({ uid, rol }, expiresIn = '2h') {
  return jwt.sign({ uid, rol }, JWT_SECRET, { issuer: JWT_ISSUER, expiresIn });
}

function signTempOnboardingToken(claims, expiresIn = '10m') {
  // claims: { sub (id), email, name, picture }
  return jwt.sign(
    { purpose: 'onboarding', ...claims, aud: 'paes-frontend' },
    JWT_SECRET,
    { issuer: JWT_ISSUER, expiresIn }
  );
}

function verifyTempOnboardingToken(token) {
  const payload = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER });
  if (payload.purpose !== 'onboarding') {
    const err = new Error('invalid_purpose');
    err.statusCode = 400;
    throw err;
  }
  return payload;
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function normalizeRol(rolRaw) {
  const r = String(rolRaw || '').trim().toLowerCase();
  // aceptamos "profesor" pero mapeamos a "docente"
  if (r === 'profesor') return 'docente';
  return r;
}

// === DB Pool (unico para este router) ===
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'paes_db',
});

// =========================================================
//                 REGISTRO (local)
// =========================================================
/**
 * POST /registro  (publica)
 * (CORREGIDO) Crea usuario local sin rol. Devuelve un temp_token
 * para forzar el flujo de onboarding (igual que Google).
 */
router.post('/registro', async (req, res) => {
  // --- (INICIO DE LA CORRECCION) ---
  // 1. Extraemos el 'rol' del body (ya no se usa)
  let { nombre, correo, contrasena } = req.body;
  nombre = (nombre || '').trim();
  correo = normalizeEmail(correo);
  // rol = normalizeRol(rol); // <-- ELIMINADO

  console.log(`--- INTENTO DE REGISTRO (local) correo:${correo} ---`);

  // 2. Modificamos la validacion (ya no requiere 'rol')
  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  // 3. Eliminamos la validacion de 'rol'
  // if (!['alumno', 'docente'].includes(rol)) { ... }

  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });
  }
  // --- (FIN DE LA CORRECCION) ---

  try {
    const exists = await pool.query('SELECT 1 FROM usuarios WHERE correo = $1 LIMIT 1', [correo]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'El correo electronico ya esta registrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(contrasena, salt);

    // --- (INICIO DE LA CORRECCION) ---
    // 4. Insertamos 'rol' como NULL y 'auth_origen' como 'local'
    const ins = await pool.query(
      `INSERT INTO usuarios (nombre, correo, contrasena, rol, correo_verificado, auth_origen)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, correo, rol`, // 'rol' sera null
      [nombre, correo, hash, null, false, 'local'] // rol es null, correo_verificado es false
    );

    const nuevoUsuario = ins.rows[0];

    // 5. Devolvemos un token temporal (igual que Google)
    const tempToken = signTempOnboardingToken({
      sub: nuevoUsuario.id, // 'sub' (subject) es el ID del usuario
      email: nuevoUsuario.correo,
      name: nuevoUsuario.nombre,
      picture: null // Los usuarios locales no tienen foto de perfil
    });

    return res.status(201).json({ temp_token: tempToken });
    // --- (FIN DE LA CORRECCION) ---

  } catch (err) {
    console.error('💥 Error en /registro:', err);
    return res.status(500).json({ error: 'Error del servidor al registrar usuario' });
  }
});

// =========================================================
/**
 * POST /login  (publica)
 * (Sin cambios)
 */
// =========================================================
router.post('/login', async (req, res) => {
  const correo = normalizeEmail(req.body?.correo);
  const contrasena = req.body?.contrasena || '';
  console.log(`--- INTENTO DE LOGIN correo:${correo} ---`);

  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Debes ingresar correo y contrasena.' });
  }

  try {
    const q = await pool.query('SELECT * FROM usuarios WHERE correo = $1 LIMIT 1', [correo]);
    if (!q.rows.length) {
      return res.status(400).json({ error: 'Credenciales invalidas.' });
    }
    const usuario = q.rows[0];

    // (INICIO CORRECCION DE FLUJO DE LOGIN)
    // Si el usuario existe pero no ha completado el onboarding (rol es NULL),
    if (usuario.rol === null) {
        console.log(`--- Usuario ${correo} intento iniciar sesion sin rol (Onboarding incompleto). ---`);
        // El login falla. El usuario debe completar el onboarding primero.
        // El flujo de onboarding (local o Google) es la unica forma de obtener un token de sesion.
        return res.status(400).json({ error: 'Credenciales invalidas.' });
    }
    // (FIN CORRECCION DE FLUJO DE LOGIN)


    const ok = await bcrypt.compare(contrasena, usuario.contrasena || '');
    if (!ok) {
      return res.status(400).json({ error: 'Credenciales invalidas.' });
    }

    const token = signAccessToken({ uid: usuario.id, rol: usuario.rol });

    return res.status(200).json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    });
  } catch (err) {
    console.error('💥 Error en /login:', err);
    return res.status(500).json({ error: 'Error del servidor al iniciar sesion' });
  }
});

// =========================================================
//                 GOOGLE OAUTH
// =========================================================

/**
 * Lazy import + client cache para openid-client
 * (Sin cambios)
 */
let _oidcClientPromise = null;
async function getOidcClient() {
  if (_oidcClientPromise) return _oidcClientPromise;
  _oidcClientPromise = (async () => {
    const { Issuer, generators } = await import('openid-client'); // ESM dinamico
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
    }

    const googleIssuer = await Issuer.discover('https://accounts.google.com');
    const client = new googleIssuer.Client({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uris: [`${AUTH_PUBLIC_BASE_URL}/api/auth/oauth/google/callback`],
      response_types: ['code'],
    });

    return { client, generators };
  })();
  return _oidcClientPromise;
}

/**
 * GET /oauth/google/start
 * (Sin cambios)
 */
router.get('/oauth/google/start', async (req, res) => {
  try {
    const { client, generators } = await getOidcClient();

    // 1) Generamos nonce y lo guardamos DENTRO del state (firmado con JWT)
    const nonce = generators.nonce();
    const state = jwt.sign(
      { flow: 'google', nonce, t: Date.now() }, // <= guardamos el nonce aqui
      JWT_SECRET,
      { issuer: JWT_ISSUER, expiresIn: '10m' }
    );

    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce, // <= tambien se envia al authorize endpoint
    });

    return res.redirect(authUrl);
  } catch (err) {
    console.error('💥 Error en /oauth/google/start:', err);
    return res.status(500).send('Error iniciando OAuth con Google');
  }
});

/**
 * GET /oauth/google/callback
 * (Sin cambios)
 */
// --- GET /oauth/google/callback ---
router.get('/oauth/google/callback', async (req, res) => {
  try {
    const { client } = await getOidcClient();
    const params = client.callbackParams(req);

    // 2) Verificamos el state y recuperamos el nonce original
    let decodedState;
    try {
      decodedState = jwt.verify(params.state, JWT_SECRET, { issuer: JWT_ISSUER });
    } catch (e) {
      console.error('✋ state invalido:', e?.message);
      return res.redirect(`${FRONTEND_BASE_URL}/login?error=oauth_state_invalid`);
    }
    const nonce = decodedState?.nonce; // <= ESTE es el que espera openid-client

    // 3) Pasamos { state, nonce } a client.callback para validar el id_token
    const tokenSet = await client.callback(
      `${AUTH_PUBLIC_BASE_URL}/api/auth/oauth/google/callback`,
      params,
      { state: params.state, nonce } // <= ¡la clave del fix!
    );

    const claims = tokenSet.claims();
    const email = normalizeEmail(claims.email);
    const email_verified = !!claims.email_verified;
    const sub = claims.sub;
    const name = claims.name || '';
    const picture = claims.picture || '';

    if (!email || !email_verified) {
      return res.redirect(`${FRONTEND_BASE_URL}/login?error=email_not_verified`);
    }

    // ... (resto del callback igual que ya lo tienes)
    const q = await pool.query('SELECT id, nombre, correo, rol FROM usuarios WHERE correo = $1 LIMIT 1', [email]);
    if (q.rows.length) {
      const usuario = q.rows[0];

      // (INICIO CORRECCION DE FLUJO DE LOGIN GOOGLE)
      // Si el usuario existe pero tiene ROL NULL (se registro localmente y no completo onboarding)
      if (usuario.rol === null) {
          console.log(`--- Usuario Google ${email} existe pero sin rol. Enviando a Onboarding. ---`);
          // (Usamos usuario.id como 'sub' para el token temporal, para que coincida con el flujo local)
          const temp = signTempOnboardingToken({ sub: usuario.id, email, name, picture });
          const url = `${FRONTEND_BASE_URL}/onboarding?temp_token=${encodeURIComponent(temp)}`
            + (name ? `&name=${encodeURIComponent(name)}` : '')
            + (email ? `&email=${encodeURIComponent(email)}` : '')
            + (picture ? `&picture=${encodeURIComponent(picture)}` : '');
          return res.redirect(url);
      }
      // (FIN CORRECCION DE FLUJO DE LOGIN GOOGLE)

      const finalToken = signAccessToken({ uid: usuario.id, rol: usuario.rol });
      const usuarioB64 = toBase64Url(usuario);
      const url = `${FRONTEND_BASE_URL}/oauth-success?token=${encodeURIComponent(finalToken)}&usuario=${encodeURIComponent(usuarioB64)}`;
      return res.redirect(url);
    }

    // Usuario 100% nuevo (no existe en la DB)
    const temp = signTempOnboardingToken({ sub, email, name, picture }); // 'sub' es el ID de Google
    const url = `${FRONTEND_BASE_URL}/onboarding?temp_token=${encodeURIComponent(temp)}`
      + (name ? `&name=${encodeURIComponent(name)}` : '')
      + (email ? `&email=${encodeURIComponent(email)}` : '')
      + (picture ? `&picture=${encodeURIComponent(picture)}` : '');
    return res.redirect(url);

  } catch (err) {
    console.error('💥 Error en /oauth/google/callback:', err);
    return res.redirect(`${FRONTEND_BASE_URL}/login?error=oauth_callback_error`);
  }
});

// =========================================================
//           COMPLETAR PERFIL (Onboarding primera vez)
// =========================================================
/**
* POST /complete-profile
* (Sin cambios, pero ahora maneja usuarios locales Y de google)
*/
router.post('/complete-profile', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const rolRaw = req.body?.rol;
  const rol = normalizeRol(rolRaw);

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_authorization' });
  }
  if (!['alumno', 'docente'].includes(rol)) {
    return res.status(400).json({ error: 'Rol invalido. Debe ser "alumno" o "docente".' });
  }

  const tempToken = authHeader.substring('Bearer '.length).trim();

  let payload;
  try {
    payload = verifyTempOnboardingToken(tempToken);
  } catch (err) {
    console.error('✋ temp token invalido:', err?.message);
    const status = err.statusCode || 401;
    return res.status(status).json({ error: 'invalid_or_expired_temp_token' });
  }

  const { email, sub, name, picture } = payload;
  const correo = normalizeEmail(email);
  // 'sub' puede ser el ID de usuario (si es local) o el ID de Google (si es Google)
  const isGoogleSub = isNaN(Number(sub)); // Heuristica: si no es numero, es Google

  // transaccion
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Si la carrera de onboarding ocurre 2 veces, manejamos idempotencia:
    const existing = await client.query('SELECT id, nombre, correo, rol FROM usuarios WHERE correo = $1 LIMIT 1', [correo]);
    let usuario;

    if (!existing.rows.length) {
      // --- (INICIO DE LA CORRECCION) ---
      // Usuario no existe (solo deberia pasar si es Google y es 100% nuevo)
      const authOrigen = isGoogleSub ? 'google' : 'local_new?'; // Marcamos 'local' como inusual
      const avatarUrl = picture || null;

      const insUser = await client.query(
        `INSERT INTO usuarios (nombre, correo, contrasena, rol, correo_verificado, avatar_url, auth_origen)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, nombre, correo, rol`,
        [name || correo, correo, null, rol, true, avatarUrl, authOrigen]
      );
      usuario = insUser.rows[0];
      // --- (FIN DE LA CORRECCION) ---
    } else {
      // Si el usuario ya existe (flujo local, o Google repetido)
      usuario = existing.rows[0];
      // Si ya tiene rol, no lo sobrescribimos.
      // Si no tiene rol (flujo local, o Google que se registro local), le asignamos el rol.
      if (usuario.rol === null) {
          const authOrigen = isGoogleSub ? 'google' : 'local';
          const updateRol = await client.query(
            `UPDATE usuarios SET rol = $1, auth_origen = COALESCE(auth_origen, $2), avatar_url = COALESCE(avatar_url, $3)
             WHERE id = $4
             RETURNING id, nombre, correo, rol`,
            [rol, authOrigen, picture || null, usuario.id]
          );
          usuario = updateRol.rows[0];
      }
    }

    // Vincular proveedor (idempotente)
    // Solo si el 'sub' es de Google (no es numerico)
    if (isGoogleSub) {
      await client.query(
        `INSERT INTO usuario_proveedores (usuario_id, proveedor, proveedor_uid)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [usuario.id, 'google', String(sub)]
      );
    }

    await client.query('COMMIT');

    // Emitir token final
    const finalToken = signAccessToken({ uid: usuario.id, rol: usuario.rol });

    return res.status(200).json({
      token: finalToken,
      usuario,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('💥 Error en /complete-profile:', err);
    return res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

// =========================================================
//           RUTA AUXILIAR (opcional) para probar auth
// =========================================================
/**
 * GET /me  (protegida si montas verifyToken antes de este router)
 * (Sin cambios)
 */
router.get('/me', (req, res) => {
  if (!req.user?.uid) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: req.user });
});

// =========================================================
//           ELIMINADA: /upgrade-docente
// =========================================================
// router.post('/upgrade-docente', ... )  --> ❌ eliminado por definicion del flujo

module.exports = router;