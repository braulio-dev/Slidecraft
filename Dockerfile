# Use Node.js 18 Debian slim image (Debian has reliable LibreOffice support)
FROM node:18-slim

# Install system dependencies:
#   - pandoc            : Markdown → PPTX conversion
#   - libreoffice-impress : PPTX → PDF (for real slide thumbnails)
#   - poppler-utils     : PDF → PNG  (pdftoppm)
#   - fonts             : so slides render with proper typography
RUN apt-get update && apt-get install -y --no-install-recommends \
      pandoc \
      libreoffice-impress \
      poppler-utils \
      fonts-dejavu \
      fonts-freefont-ttf \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p /app/uploads /app/public/thumbnails

# Expose ports for frontend (3000) and backend (4000)
EXPOSE 3000 4000

# Default command (can be overridden in docker-compose)
CMD ["npm", "start"]