import { pool } from "../db.js";

export async function listColegios(req, res) {
  const q = (req.query.query || "").trim();
  if (!q) {
    const { rows } = await pool.query(
      "SELECT id, nombre, comuna FROM colegios ORDER BY nombre LIMIT 50"
    );
    return res.json(rows);
  }
  const { rows } = await pool.query(
    `SELECT id, nombre, comuna
       FROM colegios
      WHERE nombre ILIKE $1 OR COALESCE(comuna,'') ILIKE $1
      ORDER BY nombre
      LIMIT 50`,
    [`%${q}%`]
  );
  res.json(rows);
}

export async function createColegio(req, res) {
  const { nombre, comuna } = req.body || {};
  if (!nombre?.trim()) return res.status(422).json({ error: "nombre requerido" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO colegios (nombre, comuna, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT ON CONSTRAINT uq_colegios_nombre_comuna DO NOTHING
       RETURNING id, nombre, comuna`,
      [nombre.trim(), comuna || null, req.user?.id || null]
    );
    if (!rows.length) {
      const sug = await pool.query(
        `SELECT id, nombre, comuna FROM colegios
          WHERE nombre ILIKE $1
          LIMIT 5`,
        [`%${nombre}%`]
      );
      return res.status(409).json({ error: "duplicado_probable", sugerencias: sug.rows });
    }
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: "db_error", detail: e.message });
  }
}