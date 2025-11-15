# Minecraft Bot for Aternos Server

## Overview
This is a Minecraft bot built with Node.js and mineflayer that connects to an Aternos server. The bot walks in circular patterns (clockwise and anti-clockwise) while jumping, and places/breaks blocks in a repeating cycle.

## Recent Changes
- **November 14, 2025**: Fixed Render deployment issue
  - Added Express-based health check server (server.js) that runs on port 3000
  - Server.js spawns and supervises the bot process as a child process
  - Bot now properly reads configuration from environment variables (MINECRAFT_HOST, MINECRAFT_PORT, etc.)
  - Created render.yaml for easy Render Blueprint deployment
  - Updated package.json with Express dependency and new start script
  - Health endpoints available at /health and / for monitoring bot status
  - Solves "Port scan timeout" error by binding to a port as Render requires
  - Updated README with comprehensive Render deployment instructions

- **November 14, 2025**: Fixed block placement and breaking issues
  - Fixed Vec3 usage for proper position handling
  - Added multiple placement direction fallback strategies (above head, at feet, ground levels)
  - Improved error handling and detailed logging for placement failures
  - Added validation checks for target and reference blocks
  - Increased delays for better server synchronization (500ms after placement, 700ms before breaking)
  - Added post-breaking verification to confirm block removal
  - Improved position calculation using `pos.floored()` for accurate block coordinates
  - Added detailed logging to help diagnose server permission issues

- **November 14, 2025**: Added auto-sleep and inventory management
  - Implemented nighttime detection using bot.time.timeOfDay (night = 13000-23000 ticks)
  - Added automatic sleep functionality - bot sleeps when night falls
  - Bot finds nearby beds or automatically places one from inventory if none found
  - Improved bed placement logic with multiple direction fallback strategies (east, west, south, north)
  - Added proper Vec3 position handling and validation for bed placement
  - Enhanced error handling and detailed logging for bed placement attempts
  - Added pathfinding to navigate to bed before sleeping
  - Bot automatically resumes circular pattern after waking
  - Added inventory checking on spawn for bed and dirt
  - Updated config.json with requiredInventory settings
  - Night monitoring integrated into circular pattern loop

- **November 14, 2025**: Replit environment setup
  - Installed Node.js 20 with npm dependencies
  - Configured workflow to run bot with `npm start`
  - Set up .gitignore for auth-cache and node_modules
  - Created .env.example file for user reference
  - Bot automatically starts when workflow is run

- **November 14, 2025**: Updated to circular walking pattern
  - Implemented circular walking pattern (clockwise and anti-clockwise)
  - Added jumping while walking functionality
  - Bot now walks 2 rounds clockwise, places/breaks block, then 2 rounds anti-clockwise, places/breaks block, and repeats
  - Updated config.json with circular path configuration (center point, radius, walk speed)
  - Replaced location-based movement with circular trigonometric path generation
  - Updated README with circular pattern documentation

- **November 14, 2025**: Initial project setup with Microsoft authentication
  - Created bot.js with mineflayer integration
  - Added Microsoft authentication support for Aternos online-mode servers
  - Implemented device code flow with onMsaCode handler
  - Added automatic reconnection logic (up to 10 attempts)
  - Added pathfinding support with mineflayer-pathfinder
  - Added environment-based configuration with .env
  - Created comprehensive README with Microsoft auth instructions
  - Added auth-cache directory for token storage

## Project Architecture

### Structure
```
.
├── server.js           # Health check server and bot supervisor
├── bot.js              # Main bot logic
├── config.json         # Location and behavior configuration
├── package.json        # Node.js dependencies
├── render.yaml         # Render deployment configuration
├── .env.example        # Example environment variables
├── .env                # Actual environment variables (not in git)
└── README.md           # Documentation
```

### Key Components
1. **server.js**: Health check server and process supervisor containing:
   - Express HTTP server that binds to port 3000 (required for Render deployment)
   - Health check endpoints at /health and / for monitoring
   - Bot process spawning and supervision
   - Automatic bot restart on crashes
   - Graceful shutdown handling for SIGTERM and SIGINT

2. **bot.js**: Main application file containing:
   - Minecraft server connection logic (reads from environment variables)
   - Circular path generation using trigonometry
   - Pathfinding and movement system with jumping
   - Block placement and breaking functionality
   - Clockwise and anti-clockwise walking logic
   - Event handlers for bot lifecycle and reconnection

3. **config.json**: Configuration for:
   - Circle center coordinates (x, y, z)
   - Circle radius in blocks
   - Number of waypoints per circle
   - Block type to place/break
   - Walking speed and jump settings
   - Delay between actions

### Dependencies
- `express`: HTTP server for health checks and Render compatibility
- `mineflayer`: Core Minecraft bot framework
- `mineflayer-pathfinder`: Navigation and pathfinding
- `dotenv`: Environment variable management

## Configuration Required

### Environment Variables
Users need to set up these environment variables:
- `MINECRAFT_HOST`: Aternos server address
- `MINECRAFT_PORT`: Server port (usually 25565)
- `MINECRAFT_USERNAME`: Microsoft account email for online mode, or any username for offline mode
- `MINECRAFT_VERSION`: Minecraft version (e.g., 1.20.1)
- `MINECRAFT_AUTH`: Authentication mode ('microsoft' for online servers, 'offline' for cracked servers)

### Server Requirements
- Aternos server must be running
- Bot account may need to be whitelisted
- Bot needs blocks in inventory for placement
- Server must allow block placement/breaking

## Getting Started on Replit

### Quick Start
1. **Create your .env file**: Copy `.env.example` to `.env` and fill in your Aternos server details
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your server information:
   - `MINECRAFT_HOST`: Your Aternos server address (e.g., craftpixel-R1dt.aternos.me)
   - `MINECRAFT_PORT`: Your server port (shown on Aternos dashboard when server is running)
   - `MINECRAFT_USERNAME`: Your Microsoft account email (for online mode)
   - `MINECRAFT_VERSION`: Your server's Minecraft version
   - `MINECRAFT_AUTH`: Set to `microsoft` for Aternos servers

2. **Customize bot behavior**: Edit `config.json` to set:
   - Circle center coordinates where bot will walk
   - Circle radius (how big the circle is)
   - Block type to place/break (must be in bot's inventory)
   - Walking speed and jump settings

3. **Start your Aternos server**: Make sure your server is online before running the bot

4. **Run the bot**: Click the "Run" button or restart the workflow
   - The bot will display a Microsoft authentication link if needed
   - Follow the on-screen instructions to authenticate
   - Once authenticated, the bot will connect and start walking

### Important Notes
- The bot needs blocks in its inventory to place them (use creative mode or `/give` command)
- Add the bot to your server whitelist if enabled
- The bot will automatically reconnect if disconnected (up to 10 attempts)
- Authentication is cached in the `auth-cache` folder - you only need to authenticate once

## Usage
1. Configure `.env` with server details
2. Edit `config.json` with desired locations and blocks
3. Start Aternos server
4. Run `npm start`

## Deployment
The bot is designed to be deployed on Render.com by connecting a GitHub repository. See README.md for detailed deployment instructions.
