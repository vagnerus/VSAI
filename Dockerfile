# ─── Stage 1: Build Frontend ─────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ─── Stage 2: Production Runtime ─────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia código do servidor e frontend buildado
COPY --from=builder /app/dist ./dist
COPY src ./src
COPY nexus.config.json ./nexus.config.json

# Cria diretórios de dados
RUN mkdir -p data/sessions data/tmp data/projects logs

# Usuário não-root para segurança
RUN addgroup -g 1001 -S nexus && adduser -S nexus -u 1001 -G nexus
RUN chown -R nexus:nexus /app
USER nexus

EXPOSE 3777

ENV NODE_ENV=production
ENV PORT=3777

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3777/api/health || exit 1

CMD ["node", "src/server/index.js"]
