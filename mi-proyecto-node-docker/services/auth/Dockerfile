# services/<servicio>/Dockerfile  (ejemplo: services/auth/Dockerfile)
FROM node:18

# 1. instala dependencias SOLO de este servicio ---------------
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# 2. copia el código de ESTE servicio y la carpeta común ------
COPY . /app/services/auth/
COPY ../../_common /app/_common/

# 3. nos metemos en el servicio  -------------------------------
WORKDIR /app/services/auth 
CMD ["node", "index.js"]
