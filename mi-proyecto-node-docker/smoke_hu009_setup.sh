#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
TEST_ID="${TEST_ID:-$RANDOM}"

DOCENTE_EMAIL="profe.hu009@test.com"
ALUMNO_EMAIL="alumno.hu009@test.com"
PASS="secreto123"

say()  { echo -e "$*"; }
body() { printf "%s" "$1" | sed '$d'; }
code() { printf "%s" "$1" | tail -n1; }

post_json() {
  local url="$1" token="$2" json="$3"
  curl -sS -w "\n%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$json"
}
post_noauth() {
  local url="$1" json="$2"
  curl -sS -w "\n%{http_code}" -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$json"
}

get_token() {
  local email="$1" pass="$2"
  local resp="$(post_noauth "$BASE_URL/api/auth/login" "$(jq -n --arg c "$email" --arg p "$pass" '{correo:$c, contrasena:$p}')" )"
  local c="$(code "$resp")"; local b="$(body "$resp")"
  [ "$c" -lt 300 ] || { say "Login $email fallo ($c): $b"; exit 1; }
  local t="$(printf "%s" "$b" | jq -r '.token // empty')"
  [ -n "$t" ] || { say "Respuesta de login sin token para $email: $b"; exit 1; }
  echo "$t"
}

say "Iniciando Pruebas de Humo HU-009 (RUN #$TEST_ID) contra $BASE_URL"

say "\n--- Paso 0: Registro idempotente ---"
post_noauth "$BASE_URL/api/auth/registro" "$(jq -n --arg n 'Profesor HU009' --arg c "$DOCENTE_EMAIL" --arg p "$PASS" --arg r 'docente' '{nombre:$n, correo:$c, contrasena:$p, rol:$r}')" >/dev/null || true
post_noauth "$BASE_URL/api/auth/registro" "$(jq -n --arg n 'Alumno HU009'   --arg c "$ALUMNO_EMAIL"  --arg p "$PASS" --arg r 'alumno'  '{nombre:$n, correo:$c, contrasena:$p, rol:$r}')" >/dev/null || true

say "\n--- Paso 1: Logins ---"
TOKEN_DOCENTE="$(get_token "$DOCENTE_EMAIL" "$PASS")"
TOKEN_ALUMNO="$(get_token "$ALUMNO_EMAIL" "$PASS")"
say "Tokens OK. Docente=${TOKEN_DOCENTE:0:12}... Alumno=${TOKEN_ALUMNO:0:12}..."

say "\n--- Paso 2: Colegio ---"
resp="$(post_json "$BASE_URL/api/colegios" "$TOKEN_DOCENTE" "$(jq -n --arg nombre "Colegio PAES Ventanas ${TEST_ID}" --arg comuna "Test" '{nombre:$nombre, comuna:$comuna}')")"
[ "$(code "$resp")" -lt 300 ] || { say "Crear colegio ($(code "$resp")): $(body "$resp")"; exit 1; }
ID_COLEGIO="$(printf "%s" "$(body "$resp")" | jq -r '.id')"
say "Colegio ID=$ID_COLEGIO"

say "\n--- Paso 3: Curso ---"
resp="$(post_json "$BASE_URL/api/cursos" "$TOKEN_DOCENTE" "$(jq -n --argjson colegioId "$ID_COLEGIO" --arg nombre "Curso Ventanas ${TEST_ID}" --argjson anio 2025 --arg seccion "A" '{colegioId:$colegioId, nombre:$nombre, anio:$anio, seccion:$seccion}')")"
if [ "$(code "$resp")" -ge 300 ]; then
  # fallback snake_case
  resp="$(post_json "$BASE_URL/api/cursos" "$TOKEN_DOCENTE" "$(jq -n --argjson colegio_id "$ID_COLEGIO" --arg nombre "Curso Ventanas ${TEST_ID}" --argjson anio 2025 --arg seccion "A" '{colegio_id:$colegio_id, nombre:$nombre, anio:$anio, seccion:$seccion}')")"
fi
[ "$(code "$resp")" -lt 300 ] || { say "Crear curso ($(code "$resp")): $(body "$resp")"; exit 1; }
ID_CURSO="$(printf "%s" "$(body "$resp")" | jq -r '.id')"
say "Curso ID=$ID_CURSO"

say "\n--- Paso 4: Unirse curso (alumno) ---"
resp="$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL/api/cursos/${ID_CURSO}/unirse" -H "Authorization: Bearer $TOKEN_ALUMNO")"
[ "$(code "$resp")" -lt 300 ] || { say "Unirse curso ($(code "$resp")): $(body "$resp")"; exit 1; }
say "Alumno unido al curso"

say "\n--- Paso 5: Ensayos ---"
resp="$(post_json "$BASE_URL/api/ensayos/crear-ensayo-con-preguntas" "$TOKEN_DOCENTE" "$(jq -n '{titulo:"Ensayo por Ventana M1", materia_id:2, preguntas:[1,2], disponibilidad:"ventana"}')")"
[ "$(code "$resp")" -lt 300 ] || { say "Ensayo ventana ($(code "$resp")): $(body "$resp")"; exit 1; }
ID_ENSAYO_VENTANA="$(printf "%s" "$(body "$resp")" | jq -r '.ensayo.id // .id')"
say "Ensayo ventana ID=$ID_ENSAYO_VENTANA"

resp="$(post_json "$BASE_URL/api/ensayos/crear-ensayo-con-preguntas" "$TOKEN_DOCENTE" "$(jq -n '{titulo:"Ensayo Permanente C1 (2 intentos)", materia_id:4, preguntas:[3], disponibilidad:"permanente", max_intentos:2}')")"
[ "$(code "$resp")" -lt 300 ] || { say "Ensayo permanente ($(code "$resp")): $(body "$resp")"; exit 1; }
ID_ENSAYO_PERM="$(printf "%s" "$(body "$resp")" | jq -r '.ensayo.id // .id')"
say "Ensayo permanente ID=$ID_ENSAYO_PERM"

say "\n--- Paso 6: Ventana ACTIVA ---"
AHORA="$(date --iso-8601=seconds --utc)"
resp="$(post_json "$BASE_URL/api/ensayos/${ID_ENSAYO_VENTANA}/ventanas" "$TOKEN_DOCENTE" "$(jq -n --argjson curso_id "$ID_CURSO" --arg inicio "$AHORA" --argjson duracion_min 60 '{curso_id:$curso_id, inicio:$inicio, duracion_min:$duracion_min}')")"
[ "$(code "$resp")" -lt 300 ] || { say "Ventana ACTIVA ($(code "$resp")): $(body "$resp")"; exit 1; }
ID_VENTANA_ACTIVA="$(printf "%s" "$(body "$resp")" | jq -r '.id')"
say "Ventana activa ID=$ID_VENTANA_ACTIVA"
