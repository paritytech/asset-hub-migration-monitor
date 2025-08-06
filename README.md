# AH Monitoring

A monitoring dashboard for Asset Hub migration status and XCM message tracking.

## Prerequisites

- Node.js (v18 or later)
- Yarn package manager
    - If you dont have run you can install it with npm globally: `npm install -g yarn`
- Just command runner (`brew install just` on macOS)
- Docker (optional, for containerized deployment)

## Environment Variables

Before running the application, you need to set the following environment variables:

```bash
# Asset Hub WebSocket URL
export ASSET_HUB_URL="wss://your-asset-hub-node.io"

# Relay Chain WebSocket URL
export RELAY_CHAIN_URL="wss://your-relay-chain-node.io"
```

## Installation

1. Clone the repository:
```bash
git clone git@github.com:TarikGul/asset-hub-migration-monitor.git
cd asset-hub-migration-monitor
```

2. Install dependencies and start the application:
```bash
just run
```

or

Install dependencies and start the application with a clean db:
```bash
just run-clean
```

This command will:
- Install all dependencies for both frontend and backend
- Build both frontend and backend
- Migrate and create the DB
- Start both development servers

## Docker Support

### Running Backend with Docker

The backend can be run in a Docker container for easy deployment and consistency across environments.

#### Using Docker Compose (Recommended)

```bash
# Build and start the backend
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop the service
docker-compose down
```

#### Using Docker Commands

```bash
# Build the image
docker build -t ah-monitoring-backend ./backend

# Run the container
docker run -p 3000:3000 -v $(pwd)/backend/data:/app/data ah-monitoring-backend

# Run in background
docker run -d -p 3000:3000 -v $(pwd)/backend/data:/app/data --name ah-backend ah-monitoring-backend

# Stop the container
docker stop ah-backend

# Remove the container
docker rm ah-backend
```

#### Environment Variables with Docker

You can pass environment variables to the Docker container:

```bash
# Using docker run
docker run -p 3000:3000 \
  -e ASSET_HUB_URL="wss://your-asset-hub-node.io" \
  -e RELAY_CHAIN_URL="wss://your-relay-chain-node.io" \
  -v $(pwd)/backend/data:/app/data \
  ah-monitoring-backend

# Using docker-compose (add to docker-compose.yml)
environment:
  - ASSET_HUB_URL=wss://your-asset-hub-node.io
  - RELAY_CHAIN_URL=wss://your-relay-chain-node.io
```

**Important**: If your WebSocket endpoints are running on the host machine (localhost), use `host.docker.internal` instead of `127.0.0.1` or `localhost`:

```bash
# For services running on your host machine
-e ASSET_HUB_URL="ws://host.docker.internal:63170"
-e RELAY_CHAIN_URL="ws://host.docker.internal:63168"
```

This allows the Docker container to connect to services running on your host machine.

#### Database Persistence

The SQLite database is persisted in the `./backend/data` directory, which is mounted as a volume in the Docker container. The database schema and initial data are automatically created when the container starts.

## Development

The application consists of two parts:

### Backend
- Runs on `http://localhost:8080`
- Handles WebSocket connections to Asset Hub and Relay Chain
- Processes and stores migration status and XCM message data
- Provides SSE endpoints for real-time updates

### Frontend
- Runs on `http://localhost:3000`
- Displays migration status and XCM message counters
- Shows real-time block numbers for both chains
- Updates automatically via SSE

### Frontend-Backend Connection

The frontend connects to the backend via Server-Sent Events (SSE) at `/api/updates`. 

**Dynamic Backend URL:**
- The frontend includes a backend URL input field in the header (development builds only)
- Users can connect to any backend instance by entering the URL
- Supports both local and remote backend instances
- Shows connection status (connected/disconnected)
- Defaults to `http://localhost:8080` in development

**Query Parameter Configuration:**
- You can set the backend URL via query parameter: `?backend_url=http://your-backend:8080`
- Examples:
  - `http://localhost:3000?backend_url=http://192.168.1.100:8080`
  - `http://localhost:3000?backend_url=https://api.yourdomain.com`
- Query parameter takes precedence over defaults but can still be overridden via the UI input field
- Useful for direct links to specific backend instances or automated testing
- Only available in development builds

**Development Setup:**
- Uses `webpack.dev.js` configuration
- Frontend expects the backend to be available at `http://localhost:8080` by default
- When running the backend in Docker, the port mapping must expose port 8080 to match what the frontend expects:

```yaml
# docker-compose.yml
ports:
  - "8080:8080"  # External:Internal - must match frontend expectation
```

**Production Setup:**
- Uses `webpack.prod.js` configuration
- Frontend uses relative URLs (e.g., `/api/updates`) 
- Backend URL input field is hidden
- Build with: `yarn build` or `npm run build`

**Usage:**
1. Click the backend URL field in the header (development only)
2. Enter the backend URL (e.g., `localhost:8080`, `api.yourdomain.com`, `192.168.1.100:8080`)
3. Click "Connect" to establish the connection
4. The connection status will show green (connected) or red (disconnected)

### Frontend Build Configuration

The frontend uses the `ALLOW_REMOTE_BACKEND` environment variable to control backend URL configuration:

- **Development builds**: `ALLOW_REMOTE_BACKEND=true` (set in `webpack.dev.js`)
  - Backend URL input field is visible
  - Query parameter backend URL works
  
- **Production builds**: `ALLOW_REMOTE_BACKEND=false` (set in `webpack.prod.js`)
  - Backend URL input field is hidden
  - Query parameter backend URL is disabled
  - Uses relative URLs only

## Available Commands

- `just install` - Install dependencies for both frontend and backend
- `just build` - Build both frontend and backend
- `just run-backend` - Run backend development server
- `just run-frontend` - Run frontend development server
- `just dev` - Run both frontend and backend in development mode
- `just clean` - Clean build artifacts
- `just run` - Setup everything and run in development mode
- `just run-clean` - Setup everything with clean database and run in development mode
