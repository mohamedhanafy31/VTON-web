# Virtual Try-On Application

A web application that allows users to try on garments virtually using AI technology.

## Quick Start

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy the env.example file to .env and configure your settings:
```bash
cp env.example .env
```

3. Run the application:
```bash
python start.py
```

4. Visit http://localhost:8000 in your browser

## Features

- Upload and manage garment images with Cloudinary
- Take photos with webcam or upload from files
- Virtual try-on using ArtificialStudio's AI
- Dark/light mode with state persistence
- Progress stepper to guide users through the process
- Download try-on results
- Search and filter functionality for garments

## Project Structure

```
App/
├── api/                    # API backend
│   ├── models/             # Pydantic data models
│   ├── routers/            # API route handlers
│   └── services/           # Business logic services (to be implemented)
├── config/                 # Configuration settings
├── static/                 # Static web files
│   ├── tryon.html          # Main application interface
│   └── index.html          # Garment upload interface
├── app.py                  # FastAPI application
├── start.py                # Startup script
└── requirements.txt        # Python dependencies
```

## Development

- For development mode with auto-reload:
```bash
python start.py --dev
```

- To change port or host:
```bash
python start.py --port 5000 --host 127.0.0.1
```

- For detailed logs:
```bash
python start.py --log-level DEBUG
```

## API Documentation

Once the server is running, you can access the auto-generated API documentation at:
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc (ReDoc)

## Mock Implementation Note

This version contains mock implementations for the API calls. For a production version, you would need to implement:

1. Connect to Cloudinary for actual image storage
2. Implement full ArtificialStudio integration
3. Add authentication and security features
4. Set up proper background tasks for long-running operations

## License

MIT License 