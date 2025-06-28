###################  fase dependencias  ###################
FROM node:18-alpine AS deps

#  ← WORKDIR queda dentro del micro-servicio concreto
ARG  SERVICE
WORKDIR /app/${SERVICE}

# ───────── manifest del micro-servicio ─────────
COPY ${SERVICE}/package*.json ./
RUN npm install --omit=dev

###################  fase final  ##########################
FROM node:18-alpine

ARG  SERVICE
WORKDIR /app/${SERVICE}

# dependencias ya listas
COPY --from=deps /app/${SERVICE}/node_modules ./node_modules

# código del micro-servicio
COPY ${SERVICE} .                          

# ► código compartido  (fíjate en la ruta) ◄
COPY services/_common /app/services/_common

ENV NODE_ENV=production
EXPOSE ${PORT:-5000}
CMD ["node", "index.js"]
