#!/usr/bin/env bash
# DEBUG: NO usa 'set -e' ni 'exit', nunca cierra tu shell
set +e
BASE_URL="${BASE_URL:-http://localhost}"
TEST_ID="${TEST_ID:-$RANDOM}"

DOCENTE_EMAIL="profe.hu009@test.com"
ALUMNO_EMAIL="alumno.hu009@test.com"
PASS="secreto123"

echo "Iniciando Pruebas de Humo (DEBUG) #$TEST_ID contra $BASE_URL"

# Helpers muy simples (sin exit)
post_json() {
  local url="$1" token="$2" json="$3"
  curl -sS -w "\n%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$json"
}
post_json_noauth() {
  local url="$1" json="$2"
  curl -sS -w "\n%{http_code}" -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$json"
}
extract_last_code() { printf "%s" "$1" | tail -n1; }
extract_body()      { printf "%s" "$1" | sed '$d'; }

echo -e "\n--- Paso 0: Registro idempotente ---"
R1="$(post_json_noauth "$BASE_URL/api/auth/registro" "$(jq -n --arg n 'Profesor HU009' --arg c "$DOCENTE_EMAIL" --arg p "$PASS" --arg r 'docente' '{nombre:$n, correo:$c, contrasena:$p, rol:$r}')")"
echo "registro docente: $(extract_last_code "$R1")"
R2="$(post_json_noauth "$BASE_URL/api/auth/registro" "$(jq -n --arg n 'Alumno HU009'   --arg c "$ALUMNO_EMAIL"  --arg p "$PASS" --arg r 'alumno'  '{nombre:$n, correo:$c, contrasena:$p, rol:$r}')")"
echo "registro alumno : $(extract_last_code "$R2")"

echo -e "\n--- Paso 1: Logins ---"
LDoc="$(post_json_noauth "$BASE_URL/api/auth/login" "$(jq -n --arg c "$DOCENTE_EMAIL" --arg p "$PASS" '{correo:$c, contrasena:$p}')")"
LDoc_code="$(extract_last_code "$LDoc")"; LDoc_body="$(extract_body "$LDoc")"
echo "login docente code=$LDoc_code"
echo "login docente body=$LDoc_body"
TOKEN_DOCENTE="$(printf "%s" "$LDoc_body" | jq -r '.token // .data.token // empty')"
echo "TOKEN_DOCENTE=${TOKEN_DOCENTE:0:24}..."

LAlu="$(post_json_noauth "$BASE_URL/api/auth/login" "$(jq -n --arg c "$ALUMNO_EMAIL" --arg p "$PASS" '{correo:$c, contrasena:$p}')")"
LAlu_code="$(extract_last_code "$LAlu")"; LAlu_body="$(extract_body "$LAlu")"
echo "login alumno  code=$LAlu_code"
echo "login alumno  body=$LAlu_body"
TOKEN_ALUMNO="$(printf "%s" "$LAlu_body" | jq -r '.token // .data.token // empty')"
echo "TOKEN_ALUMNO=${TOKEN_ALUMNO:0:24}..."

echo -e "\n--- Paso 2: Colegio ---"
COLEGIO_JSON="$(jq -n --arg nombre "Colegio PAES Ventanas ${TEST_ID}" --arg comuna "Test" '{nombre:$nombre, comuna:$comuna}')"
Cresp="$(post_json "$BASE_URL/api/colegios" "$TOKEN_DOCENTE" "$COLEGIO_JSON")"
Ccode="$(extract_last_code "$Cresp")"; Cbody="$(extract_body "$Cresp")"
echo "colegios code=$Ccode"
echo "colegios body=$Cbody"
ID_COLEGIO="$(printf "%s" "$Cbody" | jq -r '.id // .colegio.id // .data.id // empty')"
echo "ID_COLEGIO=$ID_COLEGIO"

echo -e "\n--- Paso 3: Curso (camel), si falla intento snake ---"
CURSO_JSON_CAMEL="$(jq -n --argjson colegioId "${ID_COLEGIO:-0}" --arg nombre "Curso Ventanas ${TEST_ID}" --argjson anio 2025 --arg seccion "A" '{colegioId:$colegioId, nombre:$nombre, anio:$anio, seccion:$seccion}')"
Cu1="$(post_json "$BASE_URL/api/cursos" "$TOKEN_DOCENTE" "$CURSO_JSON_CAMEL")"
Cu1code="$(extract_last_code "$Cu1")"; Cu1body="$(extract_body "$Cu1")"
echo "cursos (camel) code=$Cu1code"
echo "cursos (camel) body=$Cu1body"

if [ "$Cu1code" -ge 300 ]; then
  CURSO_JSON_SNAKE="$(jq -n --argjson colegio_id "${ID_COLEGIO:-0}" --arg nombre "Curso Ventanas ${TEST_ID}" --argjson anio 2025 --arg seccion "A" '{colegio_id:$colegio_id, nombre:$nombre, anio:$anio, seccion:$seccion}')"
  Cu2="$(post_json "$BASE_URL/api/cursos" "$TOKEN_DOCENTE" "$CURSO_JSON_SNAKE")"
  Cu2code="$(extract_last_code "$Cu2")"; Cu2body="$(extract_body "$Cu2")"
  echo "cursos (snake) code=$Cu2code"
  echo "cursos (snake) body=$Cu2body"
  CURSO_CODE="$Cu2code"; CURSO_BODY="$Cu2body"
else
  CURSO_CODE="$Cu1code"; CURSO_BODY="$Cu1body"
fi

ID_CURSO="$(printf "%s" "$CURSO_BODY" | jq -r '.id // .curso.id // .data.id // empty')"
echo "ID_CURSO=$ID_CURSO"

echo -e "\n--- Paso 4: Unirse curso (alumno) ---"
Join="$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL/api/cursos/${ID_CURSO}/unirse" -H "Authorization: Bearer $TOKEN_ALUMNO")"
Jcode="$(extract_last_code "$Join")"; Jbody="$(extract_body "$Join")"
echo "unirse code=$Jcode"
echo "unirse body=$Jbody"

echo -e "\n--- Paso 5: Ensayos ---"
E1="$(post_json "$BASE_URL/api/ensayos/crear-ensayo-con-preguntas" "$TOKEN_DOCENTE" "$(jq -n '{titulo:"Ensayo por Ventana M1", materia_id:2, preguntas:[1,2], disponibilidad:"ventana"}')")"
E1code="$(extract_last_code "$E1")"; E1body="$(extract_body "$E1")"
echo "crear ensayo ventana code=$E1code"
echo "crear ensayo ventana body=$E1body"
ID_ENSAYO_VENTANA="$(printf "%s" "$E1body" | jq -r '.ensayo.id // .id // empty')"
echo "ID_ENSAYO_VENTANA=$ID_ENSAYO_VENTANA"

E2="$(post_json "$BASE_URL/api/ensayos/crear-ensayo-con-preguntas" "$TOKEN_DOCENTE" "$(jq -n '{titulo:"Ensayo Permanente C1 (2 intentos)", materia_id:4, preguntas:[3], disponibilidad:"permanente", max_intentos:2}')")"
E2code="$(extract_last_code "$E2")"; E2body="$(extract_body "$E2")"
echo "crear ensayo perm code=$E2code"
echo "crear ensayo perm body=$E2body"
ID_ENSAYO_PERM="$(printf "%s" "$E2body" | jq -r '.ensayo.id // .id // empty')"
echo "ID_ENSAYO_PERM=$ID_ENSAYO_PERM"

echo -e "\n--- Paso 6: Ventana ACTIVA ---"
AHORA="$(date --iso-8601=seconds --utc)"
V1="$(post_json "$BASE_URL/api/ensayos/${ID_ENSAYO_VENTANA}/ventanas" "$TOKEN_DOCENTE" "$(jq -n --argjson curso_id "${ID_CURSO:-0}" --arg inicio "$AHORA" --argjson duracion_min 60 '{curso_id:$curso_id, inicio:$inicio, duracion_min:$duracion_min}')")"
V1code="$(extract_last_code "$V1")"; V1body="$(extract_body "$V1")"
echo "ventana ACTIVA code=$V1code"
echo "ventana ACTIVA body=$V1body"
ID_VENTANA_ACTIVA="$(printf "%s" "$V1body" | jq -r '.id // .ventana.id // .data.id // empty')"
echo "ID_VENTANA_ACTIVA=$ID_VENTANA_ACTIVA"

echo -e "\n--- Paso 7: Disponibles alumno (debug) ---"
curl -s "$BASE_URL/api/alumno/ensayos-disponibles" -H "Authorization: Bearer $TOKEN_ALUMNO" | jq . 2>/dev/null || echo "(sin JSON válido)"

echo -e "\n--- Paso 8: Rendiciones ---"
Rv1="$(curl -sS -i -X POST "$BASE_URL/api/resultados/rendiciones" -H "Authorization: Bearer $TOKEN_ALUMNO" -H "Content-Type: application/json" -d "$(jq -n --argjson ventana_id "${ID_VENTANA_ACTIVA:-null}" '{ventana_id:$ventana_id}')")"
echo "rendicion ventana (1):"; echo "$Rv1"

Rv2="$(curl -sS -i -X POST "$BASE_URL/api/resultados/rendiciones" -H "Authorization: Bearer $TOKEN_ALUMNO" -H "Content-Type: application/json" -d "$(jq -n --argjson ventana_id "${ID_VENTANA_ACTIVA:-null}" '{ventana_id:$ventana_id}')")"
echo "rendicion ventana (2):"; echo "$Rv2"

Rp1="$(curl -sS -i -X POST "$BASE_URL/api/resultados/rendiciones" -H "Authorization: Bearer $TOKEN_ALUMNO" -H "Content-Type: application/json" -d "$(jq -n --argjson ensayo_id "${ID_ENSAYO_PERM:-null}" '{ensayo_id:$ensayo_id}')")"
echo "rendicion perm (1):"; echo "$Rp1"

Rp2="$(curl -sS -i -X POST "$BASE_URL/api/resultados/rendiciones" -H "Authorization: Bearer $TOKEN_ALUMNO" -H "Content-Type: application/json" -d "$(jq -n --argjson ensayo_id "${ID_ENSAYO_PERM:-null}" '{ensayo_id:$ensayo_id}')")"
echo "rendicion perm (2):"; echo "$Rp2"

echo -e "\n--- Paso 9: Ventana FUTURA ---"
MANANA="$(date -d '+1 day' --iso-8601=seconds --utc)"
V2="$(post_json "$BASE_URL/api/ensayos/${ID_ENSAYO_VENTANA}/ventanas" "$TOKEN_DOCENTE" "$(jq -n --argjson curso_id "${ID_CURSO:-0}" --arg inicio "$MANANA" --argjson duracion_min 60 '{curso_id:$curso_id, inicio:$inicio, duracion_min:$duracion_min}')")"
V2code="$(extract_last_code "$V2")"; V2body="$(extract_body "$V2")"
echo "ventana FUTURA code=$V2code"
echo "ventana FUTURA body=$V2body"
ID_VENTANA_FUTURA="$(printf "%s" "$V2body" | jq -r '.id // .ventana.id // .data.id // empty')"
echo "ID_VENTANA_FUTURA=$ID_VENTANA_FUTURA"

RvF="$(curl -sS -i -X POST "$BASE_URL/api/resultados/rendiciones" -H "Authorization: Bearer $TOKEN_ALUMNO" -H "Content-Type: application/json" -d "$(jq -n --argjson ventana_id "${ID_VENTANA_FUTURA:-null}" '{ventana_id:$ventana_id}')")"
echo "rendicion ventana FUTURA:"; echo "$RvF"

echo -e "\n✅ DEBUG smoke finalizado (no se cerró la terminal)."
