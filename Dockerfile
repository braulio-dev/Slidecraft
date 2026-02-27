FROM node:18-slim
RUN apt-get update && apt-get install -y --no-install-recommends pandoc libreoffice-impress poppler-utils fonts-dejavu fonts-freefont-ttf fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/uploads /app/public/thumbnails
EXPOSE 3000 4000
CMD ["npm", "start"]