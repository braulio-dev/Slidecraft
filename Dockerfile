# Use Node.js 18 alpine image
FROM node:18-alpine

# Install Pandoc for PPTX conversion
RUN apk add --no-cache pandoc

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose ports for frontend (3000) and backend (4000)
EXPOSE 3000 4000

# Default command (can be overridden in docker-compose)
CMD ["npm", "start"]