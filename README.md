# Ollama Chat Frontend

A ChatGPT-like web interface for interacting with Ollama models. This is a simple, clean chat interface that connects to your local Ollama instance.

## Features

- 💬 ChatGPT-like interface
- 🤖 Model selection (automatically detects available Ollama models)
- 📝 Markdown support with syntax highlighting
- 🎨 Dark theme similar to ChatGPT
- 📱 Responsive design
- ⚡ Real-time messaging
- 🧹 Clear chat functionality

## Prerequisites

- Docker and Docker Compose installed
- Ollama running locally (included in docker-compose.yml)

## Quick Start

1. **Clone or download this project**

2. **Start the services:**
   ```bash
   docker-compose up -d
   ```

   This will:
   - Start Ollama service
   - Pull the `qwen2.5:7b-instruct` model (you can change this in docker-compose.yml)
   - Build and start the chat frontend

3. **Access the chat interface:**
   Open your browser and go to `http://localhost:3000`

4. **Wait for initialization:**
   The first startup might take a few minutes as it downloads the AI model.

## Development Setup

If you want to run the frontend locally for development:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Ollama (if not using Docker):**
   Make sure Ollama is running on `http://localhost:11434`

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Go to `http://localhost:3000`

## Configuration

### Changing the AI Model

Edit `docker-compose.yml` and change the model in the `ollama-init` service:

```yaml
ollama-init:
  # ... other config
  command: >
    "ollama pull YOUR_PREFERRED_MODEL &&
     echo ready"
```

Popular models you can try:
- `llama2:7b`
- `codellama:7b`
- `mistral:7b`
- `phi:2.7b` (smaller, faster)

### Environment Variables

- `REACT_APP_OLLAMA_URL`: Ollama API URL (default: proxied through the React dev server)

## API Endpoints Used

The frontend communicates with Ollama using these endpoints:
- `GET /api/tags` - List available models
- `POST /api/generate` - Generate chat responses

## Troubleshooting

### "Failed to fetch models" error
- Make sure Ollama is running on port 11434
- Check if the model has been downloaded: `docker exec ollama ollama list`

### Chat not responding
- Check Ollama logs: `docker logs ollama`
- Ensure the selected model is available
- Try pulling the model manually: `docker exec ollama ollama pull qwen2.5:7b-instruct`

### Port conflicts
- Change the ports in `docker-compose.yml` if 3000 or 11434 are already in use

## Customization

The interface is built with React and can be easily customized:
- `src/App.js` - Main application logic
- `src/components/` - Individual UI components
- `src/*.css` - Styling (follows ChatGPT's color scheme)

## License

MIT License - feel free to use and modify as needed.