FROM node:18-slim AS build

# Set working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY static/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY static/ ./

# Production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy the built application from the build stage
COPY --from=build /app ./

# Create necessary directories with appropriate permissions
RUN mkdir -p uploads temp logs && \
    chown -R node:node /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV CLOUDINARY_CLOUD_NAME=dj3ewvbqm
ENV CLOUDINARY_API_KEY=182963992493551
ENV CLOUDINARY_API_SECRET=Jw9FTSGXX2VxuEaxKA-l8E2Kqag
ENV ARTIFICIAL_STUDIO_API_KEY=dd240ad8f2e64de35e0b25ecddf1b42c2a7e637d
ENV MAX_GARMENTS=6

# Expose the port the app runs on
EXPOSE 3000

# Use non-root user for security
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:3000 || exit 1

# Command to run the application
CMD ["node", "server.js"] 