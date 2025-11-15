# Minecraft Bot for Aternos Server

A Node.js bot that connects to your Minecraft Aternos server and walks in circular patterns while jumping, placing and breaking blocks.

## Features

- ✅ Connects to Minecraft servers with Microsoft authentication support
- ✅ Works with Aternos servers (online mode)
- ✅ **Walks in circular paths** (clockwise and anti-clockwise)
- ✅ **Jumps while walking** for realistic movement
- ✅ Places and breaks blocks after each circular pattern
- ✅ Configurable circle size, center point, and walking speed
- ✅ Customizable delays between actions
- ✅ Continuous loop pattern (clockwise → place/break → anti-clockwise → place/break → repeat)
- ✅ Automatic reconnection on disconnects

## Setup Instructions

### 1. Configure Server Connection

Create a `.env` file with your server details:

**For Aternos Servers (Online Mode - Recommended):**
```
MINECRAFT_HOST=your-server.aternos.me
MINECRAFT_PORT=25565
MINECRAFT_USERNAME=your-email@example.com
MINECRAFT_VERSION=1.20.1
MINECRAFT_AUTH=microsoft
```

**For Cracked/Offline Servers:**
```
MINECRAFT_HOST=your-server.aternos.me
MINECRAFT_PORT=25565
MINECRAFT_USERNAME=BotUsername
MINECRAFT_VERSION=1.20.1
MINECRAFT_AUTH=offline
```

Replace:
- `your-server.aternos.me` with your Aternos server address (found on your Aternos dashboard)
- `your-email@example.com` with your Microsoft account email (for online mode)
- `BotUsername` with any username (for offline mode only)
- `1.20.1` with your server's Minecraft version

### Microsoft Authentication (First Time Setup)

When you first run the bot with `MINECRAFT_AUTH=microsoft`, you'll see:

```
🔐 ===== MICROSOFT AUTHENTICATION REQUIRED =====
Please open this URL in your browser:
   https://www.microsoft.com/link

Enter this code:
   ABC12DEF

Code expires in 15 minutes
==============================================
```

**Steps:**
1. Open the URL in your web browser
2. Enter the code shown
3. Sign in with your Microsoft account
4. The bot will automatically connect once authenticated
5. Authentication is cached - you won't need to do this again unless you delete the `auth-cache` folder

### 2. Configure Circular Walking Pattern

Edit `config.json` to customize the bot's circular walking behavior:

```json
{
  "circleCenter": {
    "x": 0,
    "y": 64,
    "z": 0
  },
  "radius": 5,
  "pointsPerCircle": 16,
  "blockType": "dirt",
  "jumpWhileWalking": true,
  "walkSpeed": 300,
  "delayBetweenActions": 1000
}
```

**Configuration explained:**
- `circleCenter`: The center point of the circle the bot will walk around
  - `x`, `z`: Horizontal coordinates (the bot will walk around this point)
  - `y`: Height/ground level (typically 64 for overworld)
- `radius`: Size of the circle in blocks (5 = small circle, 10 = medium, 20 = large)
- `pointsPerCircle`: How many waypoints make up the circle (16 = smooth circle, higher = smoother but slower)
- `blockType`: Type of block to place/break (must be in bot's inventory, e.g., "dirt", "stone", "cobblestone")
- `jumpWhileWalking`: Whether the bot jumps while walking (true = jumps, false = walks normally)
- `walkSpeed`: Delay in milliseconds between waypoints (300 = fast, 500 = medium, 1000 = slow)
- `delayBetweenActions`: Delay between placing and breaking blocks in milliseconds

### 3. Start Your Aternos Server

Make sure your Aternos server is running before starting the bot.

### 4. Run the Bot

```bash
npm start
```

The bot will:
1. Connect to your server
2. Walk in a **clockwise** circular path for 2 complete rounds (jumping while walking)
3. Place a block next to its position and break it
4. Walk in an **anti-clockwise** circular path for 2 complete rounds (jumping while walking)
5. Place a block next to its position and break it
6. **Automatically sleep** when night falls (places a bed if none is found nearby)
7. Repeat this entire cycle indefinitely

## Important Notes

- ⚠️ **Aternos servers require Microsoft authentication** - Set `MINECRAFT_AUTH=microsoft` and use your Microsoft account email
- 📦 The bot must have blocks in its inventory to place them (use creative mode or give items with `/give` command)
- 📋 Add the bot to your server whitelist if enabled (Aternos dashboard → Players → Whitelist)
- 🔒 The bot needs appropriate permissions to place and break blocks
- 📍 Y coordinate should be a valid ground level (typically 64 for overworld)
- 🚀 Your Aternos server MUST be running and showing "Online" status before starting the bot

## Troubleshooting

**"Authentication ERROR" or "Invalid credentials":**
- Make sure `MINECRAFT_AUTH=microsoft` is set in your `.env` file
- Use your Microsoft account email (not a username) for `MINECRAFT_USERNAME`
- Delete the `auth-cache` folder and re-authenticate
- Verify your Microsoft account is 18+ or added to a Microsoft family account

**Bot can't connect:**
- Verify your Aternos server is RUNNING (not starting or offline)
- Copy the exact server address from Aternos dashboard
- Try the DynIP address shown on the server page
- Check that the port number is correct (shown on Aternos page when running)
- Ensure the server is not full

**Bot can't place blocks (timeout errors):**
- **Most Common**: Set the bot to creative mode: `/gamemode creative PLACER`
- Check for spawn protection: Move to a different location away from spawn (use `/tp PLACER X Y Z`)
- Verify the bot has OP permissions: `/op PLACER`
- Disable any protection plugins in the spawn area
- Make sure the bot has the specified blocks in its inventory
- Give blocks: `/give PLACER minecraft:dirt 64`
- Check the server logs for permission denials

**Bot can't break blocks:**
- Verify the bot has permission to break blocks
- Check for protection plugins (WorldGuard, GriefPrevention, etc.)
- Ensure gamemode allows block breaking (not adventure mode)

**Connection keeps dropping:**
- The bot has automatic reconnection (up to 10 attempts)
- Aternos servers auto-sleep when no players are online - keep the bot connected to prevent this
- Check your internet connection stability

## Deployment to Render

This bot includes a health check server that runs on port 3000, allowing it to be deployed on Render.com as a Web Service.

### Option 1: Using render.yaml (Recommended)

1. Push your code to a GitHub repository (make sure `render.yaml` is included)
2. Go to Render Dashboard and click "New +"
3. Select "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml` and configure the service
6. Add your environment variables:
   - `MINECRAFT_HOST`: Your Aternos server address
   - `MINECRAFT_PORT`: Your server port
   - `MINECRAFT_USERNAME`: Your Minecraft username/email
   - `MINECRAFT_VERSION`: Minecraft version (e.g., 1.20.1)
   - `MINECRAFT_AUTH`: Authentication mode (`microsoft` or `offline`)
7. Click "Apply" to deploy

### Option 2: Manual Setup

1. Push your code to a GitHub repository
2. Create a new **Web Service** on Render
3. Connect your GitHub repository
4. Configure the service:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
5. Add your environment variables (same as above)
6. Deploy!

### After Deployment

- Your bot will start automatically and connect to your Minecraft server
- The health check endpoint will be available at `https://your-app.onrender.com/health`
- You can view bot status at `https://your-app.onrender.com/`
- Check the logs in Render dashboard to monitor bot activity

**Note**: The free tier on Render will spin down after 15 minutes of inactivity. Your bot will automatically restart when the service spins back up.

## License

MIT
