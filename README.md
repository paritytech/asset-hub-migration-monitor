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

2. Setup the application (install dependencies, create DB, build):
```bash
just setup
```

For a clean database setup:
```bash
just setup-clean
```

3. Run the application using separate terminals for better log visibility:

**Terminal 1 - Backend:**
```bash
just run-backend
```

**Terminal 2 - Frontend:**
```bash
just run-frontend
```

This approach allows you to see all logs clearly in separate terminals and easily restart individual services.

### Quick Start
```bash
# One-time setup (creates data directory, installs dependencies, sets up database)
just setup

# Then in two separate terminals:
# Terminal 1:
just run-backend

# Terminal 2:
just run-frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080

**Note:** The backend requires a `data` directory for the SQLite database. This is automatically created by the setup commands.

## Docker Support

### Running with Docker

Both frontend and backend can be run in Docker containers for easy deployment and consistency across environments.

#### Using Docker Compose (Recommended)

```bash
# Build and start both frontend and backend
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop both services
docker-compose down

# Build and start only backend
docker-compose up backend --build

# Build and start only frontend
docker-compose up frontend --build
```

#### Development Docker Setup

For development with hot reload and backend URL input support:

```bash
# Start development containers
./start-dev.sh

# Or use just commands
just docker-dev      # Start with logs
just docker-dev-bg   # Start in background
just docker-dev-down # Stop containers
```

**Development Features:**
- Hot reload for both frontend and backend
- Backend URL input field enabled
- Separate ports (Frontend: 3000, Backend: 8080)
- Source code mounted as volumes

#### Using Docker Commands

**Backend:**
```bash
# Build the backend image
docker build -t ah-monitoring-backend ./backend

# Run the backend container
docker run -p 8080:8080 -v $(pwd)/backend/data:/app/data ah-monitoring-backend

# Run in background
docker run -d -p 8080:8080 -v $(pwd)/backend/data:/app/data --name ah-backend ah-monitoring-backend
```

**Frontend:**
```bash
# Build the frontend image
docker build -t ah-monitoring-frontend ./frontend

# Run the frontend container
docker run -p 3000:3000 ah-monitoring-frontend

# Run in background
docker run -d -p 3000:3000 --name ah-frontend ah-monitoring-frontend

# Stop containers
docker stop ah-backend ah-frontend

# Remove containers
docker rm ah-backend ah-frontend
```

> **Note**: For production deployment, you'll need a reverse proxy (like nginx) to route `/` to the frontend container and `/api/*` to the backend container, since the production frontend uses relative URLs.

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

### Setup Commands
- `just setup` - Setup everything (install dependencies, create DB, build)
- `just setup-clean` - Setup everything with clean database
- `just install` - Install dependencies for both frontend and backend
- `just build` - Build both frontend and backend
- `just db` - Create and migrate database
- `just db-clean` - Clean database and recreate
- `just clean` - Clean build artifacts

### Development Commands
- `just run-backend` - Run backend development server (use in separate terminal)
- `just run-frontend` - Run frontend development server (use in separate terminal)
- `just dev` - Run both frontend and backend in development mode (single terminal, backgrounded)

### Legacy Commands (for backwards compatibility)
- `just run` - Setup everything and run in development mode
- `just run-clean` - Setup everything with clean database and run in development mode

### Docker Commands
- `just docker-dev` - Start development Docker containers
- `just docker-dev-bg` - Start development Docker containers in background
- `just docker-dev-down` - Stop development Docker containers
