# Multi-stage build for smaller production image
# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for better parallelization
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
# Use npm ci for faster, reliable, reproducible builds
RUN if [ -f package-lock.json ]; then \
      npm ci --prefer-offline --no-audit --progress=false --loglevel=error; \
    else \
      npm install --prefer-offline --no-audit --progress=false --loglevel=error; \
    fi

# Copy only necessary source files (exclude large assets)
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
# Copy required script for server routes (create directory first)
RUN mkdir -p ./scripts
COPY scripts/weekly_sales_update.ts ./scripts/weekly_sales_update.ts
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY components.json ./

# Set build environment variables for optimization
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the application with timeout protection
RUN npm run build || (echo "Build failed, cleaning up..." && exit 1)

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install minimal dependencies for production
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install ONLY production dependencies
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --prefer-offline --no-audit --progress=false --loglevel=error && \
      npm cache clean --force; \
    else \
      npm install --omit=dev --prefer-offline --no-audit --progress=false --loglevel=error && \
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
