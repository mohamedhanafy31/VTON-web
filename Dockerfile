FROM node:18-slim AS build

# Set working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY static/ ./static/

# Production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy the built application from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/static ./static

# Create necessary directories with appropriate permissions
RUN mkdir -p static/uploads static/temp static/logs && \
    chown -R node:node /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Use non-root user for security
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:3000 || exit 1

# Command to run the application
CMD ["node", "src/server.js"] 