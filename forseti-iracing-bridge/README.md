# Forseti iRacing Bridge

A lightweight Python microservice that connects to iRacing and exposes telemetry data via HTTP API.

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Running

```bash
python main.py
```

The service will start on `http://localhost:5555`

## API Endpoints

- `GET /` - Service information
- `GET /status` - Connection status to iRacing
- `GET /telemetry` - Current telemetry data
- `GET /session` - Session information
- `POST /disconnect` - Disconnect from iRacing

## Usage with Electron

The Electron app automatically spawns this service and communicates with it via HTTP requests.
