FROM node:18-alpine

WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Build Frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Setup Backend
WORKDIR /app/backend
COPY backend/ .

# Expor porta
EXPOSE 3000

# Start Backend
CMD ["npm", "start"]
