Proyecto de Ensayos PAES: Plataforma de Evaluación Educativa
Este proyecto implementa una plataforma de ensayos educativos utilizando una arquitectura de microservicios con Node.js y PostgreSQL, orquestada con Docker Compose, y un frontend desarrollado en React.

🚀 Características Principales
Autenticación y Autorización: Gestión de usuarios (alumnos, docentes, administradores) con JWT.

Gestión de Materias: CRUD de materias.

Banco de Preguntas: Creación, edición, eliminación y listado de preguntas por materia.

Gestión de Ensayos: Creación de ensayos asociando preguntas existentes, y modificación/eliminación de ensayos.

Resolución de Ensayos: Los alumnos pueden rendir ensayos y sus respuestas son registradas.

Resultados: Visualización de resultados de ensayos para alumnos (propios) y docentes/administradores (todos).

API Gateway (Nginx): Centraliza las peticiones al backend y maneja CORS.

🛠 Tecnologías Utilizadas
Backend: Node.js, Express.js

Base de Datos: PostgreSQL

ORM/Conexión DB: pg (cliente de PostgreSQL para Node.js), bcryptjs (para hashing de contraseñas), jsonwebtoken (para JWT).

Frontend: React.js, axios (para peticiones HTTP).

Contenedorización: Docker, Docker Compose

API Gateway: Nginx

📋 Prerrequisitos
Asegúrate de tener instalado lo siguiente en tu sistema:

Docker Desktop: Incluye Docker Engine y Docker Compose.

Instalar Docker Desktop

Node.js y npm (o Yarn): Necesario para correr el frontend en desarrollo.

Instalar Node.js (se recomienda la versión LTS)

Un editor de código: Como VS Code.

⚙️ Configuración del Entorno
Clonar el Repositorio:

git clone <URL_DE_TU_REPOSITORIO_GITHUB>
cd nombre-de-tu-proyecto

Variables de Entorno (.env):
Cada microservicio de Node.js necesita su propio archivo .env para la configuración. Crea los siguientes archivos en los directorios especificados:

services/auth-service/.env

PORT=5001
JWT_SECRET=tu_secreto_muy_seguro_y_largo
DB_USER=user
DB_HOST=postgres-paes
DB_DATABASE=paes_db
DB_PASSWORD=password
DB_PORT=5432

Importante: Cambia tu_secreto_muy_seguro_y_largo por una cadena de texto aleatoria y compleja.

services/materias-service/.env

PORT=5005
DB_USER=user
DB_HOST=postgres-paes
DB_DATABASE=paes_db
DB_PASSWORD=password
DB_PORT=5432
JWT_SECRET=tu_secreto_muy_seguro_y_largo

services/preguntas-service/.env

PORT=5002
DB_USER=user
DB_HOST=postgres-paes
DB_DATABASE=paes_db
DB_PASSWORD=password
DB_PORT=5432
JWT_SECRET=tu_secreto_muy_seguro_y_largo

services/ensayos-service/.env

PORT=5003
DB_USER=user
DB_HOST=postgres-paes
DB_DATABASE=paes_db
DB_PASSWORD=password
DB_PORT=5432
JWT_SECRET=tu_secreto_muy_seguro_y_largo

services/resultados-service/.env

PORT=5004
DB_USER=user
DB_HOST=postgres-paes
DB_DATABASE=paes_db
DB_PASSWORD=password
DB_PORT=5432
JWT_SECRET=tu_secreto_muy_seguro_y_largo

services/respuestas-service/.env (si tienes un servicio de respuestas separado y usas su puerto)

PORT=5000
DB_USER=user
DB_HOST=postgres-paes
DB_DATABASE=paes_db
DB_PASSWORD=password
DB_PORT=5432
JWT_SECRET=tu_secreto_muy_seguro_y_largo

Nota: Asegúrate de que el JWT_SECRET sea exactamente el mismo en todos los archivos .env de tus microservicios y en tu docker-compose.yml (si lo defines ahí para auth-service).

Configuración de la Base de Datos (init_postgres.sql):
El archivo db/init_postgres.sql contiene los esquemas de las tablas y datos iniciales para tu base de datos PostgreSQL. Este script se ejecuta automáticamente la primera vez que el contenedor postgres-paes se levanta.

Si ya has levantado Docker Compose y tienes datos, y modificas init_postgres.sql: Necesitarás eliminar el volumen de Docker para PostgreSQL para que los cambios se apliquen.

docker volume ls # Para ver los volúmenes, busca el de tu postgres (ej. tuproyecto_postgres_data)
docker volume rm <nombre_del_volumen_postgres>

¡Advertencia! Esto eliminará permanentemente todos los datos de tu base de datos. Solo hazlo si quieres una base de datos limpia o si estás seguro de que no necesitas los datos existentes.

Instalar Dependencias del Frontend:
Navega al directorio frontend e instala las dependencias:

cd frontend
npm install # o yarn install

Configuración del Proxy del Frontend:
Asegúrate de que tu frontend/package.json tenga la línea de proxy apuntando al puerto correcto de tu Nginx gateway:

// En frontend/package.json
"proxy": "http://localhost:80"

Si tu Nginx escucha en un puerto diferente en tu host, ajústalo aquí.

🚀 Ejecutar el Proyecto
Levantar los Microservicios con Docker Compose:
Desde la raíz de tu proyecto (donde se encuentra docker-compose.yml), ejecuta:

docker-compose up --build -d

up: Inicia los servicios definidos en docker-compose.yml.

--build: Fuerza la reconstrucción de las imágenes Docker (necesario cuando hay cambios en el código de los microservicios).

-d: Ejecuta los contenedores en modo "detached" (en segundo plano).

Esto construirá las imágenes Docker para cada microservicio y las levantará junto con PostgreSQL y Nginx. Este proceso puede tardar unos minutos la primera vez.

Verificar el Estado de los Contenedores:
Puedes verificar que todos los servicios estén corriendo correctamente con:

docker-compose ps

Todos los servicios (auth-service, ensayos-service, materias-service, preguntas-service, resultados-service, respuestas-service, postgres-paes, paes-gateway) deberían mostrar Up en la columna State.

Iniciar el Frontend:
En una nueva terminal, navega al directorio frontend y ejecuta el servidor de desarrollo de React:

cd frontend
npm start # o yarn start

Esto abrirá tu aplicación React en el navegador (generalmente en http://localhost:3000).

🌐 Acceso a la Aplicación
Una vez que todos los servicios y el frontend estén en marcha:

Abre tu navegador y ve a: http://localhost:3000

Desde allí, podrás interactuar con la aplicación. Las peticiones a la API serán redirigidas por el proxy de desarrollo de React a tu Nginx Gateway (http://localhost:80), y este a su vez las enrutará al microservicio correspondiente.

🔑 Credenciales de Prueba
Para iniciar sesión y probar la aplicación, puedes usar las credenciales que insertes en tu db/init_postgres.sql. Por ejemplo:

Administrador:

Correo: admin@example.com (o el que hayas definido)

Contraseña: password123 (o la que hayas hasheado e insertado)

Docente:

Correo: docente@example.com

Contraseña: password123

Alumno:

Correo: alumno@example.com

Contraseña: password123

Importante: Asegúrate de que las contraseñas insertadas en init_postgres.sql estén hasheadas con bcryptjs, no en texto plano.

🐛 Solución de Problemas Comunes
404 Not Found en el Frontend:

Verifica que el frontend está apuntando al puerto correcto del Nginx Gateway ("proxy": "http://localhost:80" en frontend/package.json).

Asegúrate de que el Nginx Gateway (gateway/nginx.conf) tiene la configuración de proxy_pass correcta para cada microservicio y que los nombres de los upstream coinciden con los nombres de servicio en docker-compose.yml.

Reinicia completamente Docker Compose (docker-compose down y luego docker-compose up --build -d).

500 Internal Server Error o Connection Refused desde el Backend:

Revisa los logs del microservicio específico que está fallando (ej. docker-compose logs auth-service).

Asegúrate de que el microservicio esté escuchando en el puerto correcto especificado en su .env y en docker-compose.yml.

Verifica que las variables de entorno de la base de datos en los .env sean correctas (DB_HOST debe ser el nombre del servicio de la base de datos, postgres-paes).

Errores de JWT_SECRET o 401 Unauthorized/403 Forbidden:

Asegúrate de que la variable JWT_SECRET sea exactamente la misma en todos los archivos .env de los microservicios que validan tokens y en el auth-service.

Verifica que los middlewares verificarToken y authorizeRoles estén correctamente importados y utilizados en las rutas de tus microservicios.

Cambios en init_postgres.sql no se aplican:

Recuerda que init_postgres.sql solo se ejecuta la primera vez que el volumen de PostgreSQL es creado. Para aplicar cambios en el esquema o en los datos iniciales después de la primera vez, debes eliminar el volumen de Docker de PostgreSQL y luego reiniciar Docker Compose.

docker-compose down -v # Esto eliminará contenedores y volúmenes asociados
docker-compose up --build -d
