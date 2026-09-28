# Darman Studio (Docker / any VPS). Uses the embedded database in /data unless DATABASE_URL is set.
FROM node:22-bookworm-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
