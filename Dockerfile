# Multi-stage build for smaller production image
# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for better parallelization
RUN apk add --no-cache libc6-compat

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
# Use npm ci for faster, reliable, reproducible builds
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
      npm ci --prefer-offline --no-audit --progress=false; \
    else \
      npm install --prefer-offline --no-audit --progress=false; \
    fi

# Copy source code (this invalidates cache less frequently)
COPY . .

# Set build environment variables for optimization
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for production
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install ONLY production dependencies with cache
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
      npm ci --omit=dev --prefer-offline --no-audit --progress=false && \
      npm cache clean --force; \
    else \
      npm install --omit=dev --prefer-offline --no-audit --progress=false && \
      npm cache clean --force; \
    fi

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Railway will inject PORT environment variable at runtime)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
