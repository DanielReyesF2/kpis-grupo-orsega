# Multi-stage build for smaller production image
# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json ./
COPY package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install ONLY production dependencies
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev && npm cache clean --force; \
    else \
      npm install --omit=dev && npm cache clean --force; \
    fi

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (Railway will inject PORT environment variable at runtime)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
