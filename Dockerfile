# Use official Node.js Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies for native modules
RUN apk add --no-cache \
    alpine-sdk \
    libc-dev \
    libressl-dev \
    libffi-dev

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose port (if running local-bot.js)
EXPOSE 3000

# Default command (change as needed)
CMD ["node", "local-bot.js"] 