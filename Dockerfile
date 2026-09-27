# Unidesk — Self-Hosted University Helpdesk
FROM node:20-alpine AS runner

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose HTTP and WebSocket port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
