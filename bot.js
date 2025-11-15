require("dotenv").config();
const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const Vec3 = require("vec3");
const fs = require("fs");

let config;
try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch (error) {
  console.error("Error reading config.json:", error.message);
  process.exit(1);
}

const botOptions = {
  host: process.env.MINECRAFT_HOST || "craftpixel42.aternos.me",
  port: parseInt(process.env.MINECRAFT_PORT, 10) || 12635,
  username: process.env.MINECRAFT_USERNAME || "Placer",
  version: process.env.MINECRAFT_VERSION || "1.21.10",
  auth: process.env.MINECRAFT_AUTH || "offline",
  profilesFolder: "./auth-cache",
  onMsaCode: (data) => {
    console.log("\n🔐 ===== MICROSOFT AUTHENTICATION REQUIRED =====");
    console.log(`Please open this URL in your browser:`);
    console.log(`   ${data.verification_uri}`);
    console.log(`\nEnter this code:`);
    console.log(`   ${data.user_code}`);
    console.log(
      `\nCode expires in ${Math.floor(data.expires_in / 60)} minutes`,
    );
    console.log("==============================================\n");
  },
};

console.log("Starting Minecraft bot...");
console.log(`Authentication mode: ${botOptions.auth}`);
console.log(
  `Connecting to ${botOptions.host}:${botOptions.port} as ${botOptions.username}`,
);

let bot;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectDelay = 5000;

function createBot() {
  bot = mineflayer.createBot(botOptions);
  setupBotHandlers();
  return bot;
}

createBot();

let isProcessing = false;
let cycleCount = 0;
let isSleeping = false;
let nightCheckInterval = null;
let currentGamemode = null;
let gamemodeCheckInterval = null;

function setupBotHandlers() {
  bot.loadPlugin(pathfinder);

  bot.on("spawn", () => {
    console.log("Bot has spawned in the world!");
    const spawnPos = bot.entity.position;
    console.log(`Position: ${spawnPos}`);
    reconnectAttempts = 0;

    const mcData = require("minecraft-data")(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.canDig = false;
    defaultMove.allow1by1towers = false;
    bot.pathfinder.setMovements(defaultMove);

    setTimeout(async () => {
      checkAndSwitchToCreative();
      startGamemodeMonitoring();
      await checkInventory();

      console.log("Starting circular walking pattern...");
      console.log(
        `Circle center: X=${config.circleCenter.x}, Y=${config.circleCenter.y}, Z=${config.circleCenter.z}`,
      );
      console.log(`Radius: ${config.radius} blocks\n`);

      if (config.autoSleep) {
        startNightMonitoring();
      }

      startCircularPattern();
    }, 3000);
  });

  bot.on("error", (err) => {
    console.error("Bot error:", err.message);
    if (
      err.message.includes("Invalid credentials") ||
      err.message.includes("authentication")
    ) {
      console.error("\n⚠️  AUTHENTICATION ERROR ⚠️");
      console.error(
        "For Aternos servers (online mode), you need Microsoft authentication.",
      );
      console.error(
        "Set MINECRAFT_AUTH=microsoft in your .env file and follow the login prompt.",
      );
      process.exit(1);
    }
  });

  bot.on("kicked", (reason) => {
    console.log("Bot was kicked:", reason);
    attemptReconnect();
  });

  bot.on("end", () => {
    console.log("Bot disconnected");
    attemptReconnect();
  });

  bot.on("death", () => {
    console.log("Bot died! Respawning...");
  });

  bot.on("chat", (username, message) => {
    console.log(`<${username}> ${message}`);
  });
}

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(
      `Failed to reconnect after ${maxReconnectAttempts} attempts. Exiting.`,
    );
    process.exit(1);
  }

  reconnectAttempts++;
  console.log(
    `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) in ${reconnectDelay / 1000} seconds...`,
  );

  setTimeout(() => {
    isProcessing = false;
    cycleCount = 0;
    createBot();
  }, reconnectDelay);
}

function generateCirclePoints(
  centerX,
  centerZ,
  radius,
  numPoints,
  clockwise = true,
) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const actualAngle = clockwise ? angle : -angle;
    const x = centerX + radius * Math.cos(actualAngle);
    const z = centerZ + radius * Math.sin(actualAngle);
    points.push({ x: Math.floor(x), z: Math.floor(z) });
  }
  return points;
}

async function startCircularPattern() {
  if (isProcessing || isSleeping) return;
  
  if (config.autoSleep && isNightTime() && !isSleeping) {
    await tryToSleep();
    return;
  }
  
  isProcessing = true;

  try {
    cycleCount++;
    console.log(`\n========== CYCLE ${cycleCount} START ==========`);

    console.log("\n🔄 Walking CLOCKWISE for 2 rounds...");
    await walkCircle(true, 2);

    if (config.autoSleep && isNightTime() && !isSleeping) {
      console.log("\n🌙 Night detected! Stopping current cycle to sleep...");
      isProcessing = false;
      await tryToSleep();
      return;
    }

    await delay(1000);

    console.log("\n📦 Placing and breaking block...");
    await placeAndBreakBlock();
    await delay(config.delayBetweenActions);

    if (config.autoSleep && isNightTime() && !isSleeping) {
      console.log("\n🌙 Night detected! Stopping current cycle to sleep...");
      isProcessing = false;
      await tryToSleep();
      return;
    }

    await chestInteraction();

    console.log("\n🔃 Walking ANTI-CLOCKWISE for 2 rounds...");
    await walkCircle(false, 2);

    if (config.autoSleep && isNightTime() && !isSleeping) {
      console.log("\n🌙 Night detected! Stopping current cycle to sleep...");
      isProcessing = false;
      await tryToSleep();
      return;
    }

    await delay(1000);

    console.log("\n📦 Placing and breaking block...");
    await placeAndBreakBlock();
    await delay(config.delayBetweenActions);

    console.log(`\n========== CYCLE ${cycleCount} COMPLETE ==========\n`);

    isProcessing = false;
    startCircularPattern();
  } catch (error) {
    console.error("Error in circular pattern:", error.message);
    isProcessing = false;
    setTimeout(startCircularPattern, config.delayBetweenActions);
  }
}

async function walkCircle(clockwise, rounds) {
  const points = generateCirclePoints(
    config.circleCenter.x,
    config.circleCenter.z,
    config.radius,
    config.pointsPerCircle,
    clockwise,
  );

  const direction = clockwise ? "Clockwise" : "Anti-clockwise";

  for (let round = 1; round <= rounds; round++) {
    console.log(`  Round ${round}/${rounds} (${direction})`);

    for (let i = 0; i < points.length; i++) {
      if (config.autoSleep && isNightTime() && !isSleeping) {
        console.log("\n🌙 Night detected during walk! Stopping immediately to sleep...");
        bot.pathfinder.setGoal(null);
        return;
      }

      const point = points[i];
      const y = config.circleCenter.y;

      console.log(
        `    Walking to point ${i + 1}/${points.length} (${point.x}, ${y}, ${point.z})`,
      );

      const goal = new goals.GoalNear(point.x, y, point.z, 1);
      bot.pathfinder.setGoal(goal);

      let isMoving = true;
      const jumpInterval = config.jumpWhileWalking
        ? setInterval(() => {
            if (isMoving && bot.pathfinder.isMoving()) {
              bot.setControlState("jump", true);
            }
          }, 100)
        : null;

      await waitForArrival(point.x, y, point.z, 2);

      isMoving = false;
      if (jumpInterval) clearInterval(jumpInterval);
      bot.setControlState("jump", false);
      bot.pathfinder.setGoal(null);

      await delay(config.walkSpeed);
    }
  }

  console.log(`  ✅ Completed ${rounds} ${direction.toLowerCase()} rounds`);
}

async function waitForArrival(x, y, z, threshold) {
  return new Promise((resolve) => {
    const checkArrival = setInterval(() => {
      const distance = bot.entity.position.distanceTo({ x, y, z });

      if (distance < threshold) {
        clearInterval(checkArrival);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkArrival);
      resolve();
    }, 10000);
  });
}

async function moveToLocation(x, y, z) {
  return new Promise((resolve, reject) => {
    const goal = new goals.GoalNear(x, y, z, 1);
    bot.pathfinder.setGoal(goal);

    const checkArrival = setInterval(() => {
      const distance = bot.entity.position.distanceTo({ x, y, z });

      if (distance < 2) {
        clearInterval(checkArrival);
        bot.pathfinder.setGoal(null);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkArrival);
      bot.pathfinder.setGoal(null);
      resolve();
    }, 10000);
  });
}

async function findNearbyChest() {
  const chestNames = ["chest", "trapped_chest", "ender_chest"];
  const chest = bot.findBlock({
    matching: (block) => chestNames.includes(block.name),
    maxDistance: 64,
  });
  return chest;
}

async function placeChest() {
  try {
    console.log("  📦 Attempting to place a chest...");

    const currentMode = bot.game.gameMode;
    const isCreative = currentMode === 1 || currentMode === 'creative' || String(currentMode).toLowerCase() === 'creative';
    if (isCreative) {
      await ensureItemInCreativeInventory("chest", 64);
    }

    const mcData = require("minecraft-data")(bot.version);
    const chestItem = bot.inventory
      .items()
      .find((item) => item.name === "chest" || item.name === "trapped_chest");

    if (!chestItem) {
      console.log("  ⚠️  No chest in inventory");
      return null;
    }

    console.log(`  Found ${chestItem.name} in inventory`);

    const pos = bot.entity.position.floored();
    const botX = pos.x;
    const botY = pos.y;
    const botZ = pos.z;

    const placementAttempts = [];
    for (let distance = 2; distance <= 5; distance++) {
      placementAttempts.push(
        { pos: new Vec3(botX + distance, botY, botZ), ref: new Vec3(botX + distance, botY - 1, botZ), name: `${distance}m east` },
        { pos: new Vec3(botX - distance, botY, botZ), ref: new Vec3(botX - distance, botY - 1, botZ), name: `${distance}m west` },
        { pos: new Vec3(botX, botY, botZ + distance), ref: new Vec3(botX, botY - 1, botZ + distance), name: `${distance}m south` },
        { pos: new Vec3(botX, botY, botZ - distance), ref: new Vec3(botX, botY - 1, botZ - distance), name: `${distance}m north` }
      );
    }

    for (const attempt of placementAttempts) {
      const targetBlock = bot.blockAt(attempt.pos);
      const referenceBlock = bot.blockAt(attempt.ref);

      if (!targetBlock || !referenceBlock) continue;

      if (targetBlock.name === "air" && referenceBlock.name !== "air") {
        try {
          await bot.equip(chestItem, "hand");
          await delay(200);

          await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          console.log(
            `  ✅ Chest placed ${attempt.name} at (${attempt.pos.x}, ${attempt.pos.y}, ${attempt.pos.z})!`,
          );

          await delay(500);
          const placedChest = bot.blockAt(attempt.pos);
          return placedChest;
        } catch (err) {
          console.log(
            `  ⚠️  Failed to place chest ${attempt.name}: ${err.message}`,
          );
        }
      }
    }

    console.log("  ❌ Could not find suitable location to place chest within 5 blocks");
    return null;
  } catch (error) {
    console.log(`  ⚠️  Error placing chest: ${error.message}`);
    return null;
  }
}

async function openChest(chestBlock) {
  try {
    console.log(
      `  🔓 Opening chest at (${chestBlock.position.x}, ${chestBlock.position.y}, ${chestBlock.position.z})...`,
    );

    const distance = bot.entity.position.distanceTo(chestBlock.position);
    if (distance > 4) {
      console.log("  🚶 Walking to chest...");
      await moveToLocation(
        chestBlock.position.x,
        chestBlock.position.y,
        chestBlock.position.z,
      );
      await delay(300);
    }

    const chest = await bot.openChest(chestBlock);
    console.log(
      `  ✅ Chest opened! Contains ${chest.containerItems().length} item stacks`,
    );
    return chest;
  } catch (error) {
    console.log(`  ⚠️  Failed to open chest: ${error.message}`);
    return null;
  }
}

async function depositItemsToChest(chest, itemName, count = null) {
  try {
    const items = bot.inventory
      .items()
      .filter((item) => item.name === itemName || item.name.includes(itemName));

    if (items.length === 0) {
      console.log(`  ⚠️  No ${itemName} in inventory to deposit`);
      return 0;
    }

    let totalDeposited = 0;

    for (const item of items) {
      const amountToDeposit =
        count !== null
          ? Math.min(count - totalDeposited, item.count)
          : item.count;

      if (amountToDeposit <= 0) break;

      console.log(`  📥 Depositing ${amountToDeposit}x ${item.name}...`);
      await chest.deposit(item.type, null, amountToDeposit);
      totalDeposited += amountToDeposit;
      await delay(300);
    }

    console.log(`  ✅ Deposited ${totalDeposited}x ${itemName} to chest`);
    return totalDeposited;
  } catch (error) {
    console.log(`  ⚠️  Error depositing items: ${error.message}`);
    return 0;
  }
}

async function withdrawItemsFromChest(chest, itemName, count) {
  try {
    const chestItems = chest.containerItems();
    const targetItems = chestItems.filter(
      (item) => item.name === itemName || item.name.includes(itemName),
    );

    if (targetItems.length === 0) {
      console.log(`  ⚠️  No ${itemName} in chest to withdraw`);
      return 0;
    }

    let totalWithdrawn = 0;

    for (const item of targetItems) {
      const amountToWithdraw = Math.min(count - totalWithdrawn, item.count);

      if (amountToWithdraw <= 0) break;

      console.log(`  📤 Withdrawing ${amountToWithdraw}x ${item.name}...`);
      await chest.withdraw(item.type, null, amountToWithdraw);
      totalWithdrawn += amountToWithdraw;
      await delay(300);
    }

    console.log(`  ✅ Withdrew ${totalWithdrawn}x ${itemName} from chest`);
    return totalWithdrawn;
  } catch (error) {
    console.log(`  ⚠️  Error withdrawing items: ${error.message}`);
    return 0;
  }
}

async function chestInteraction() {
  if (!config.chestInteraction || !config.chestInteraction.enabled) {
    return;
  }

  try {
    console.log("\n🗄️  === CHEST INTERACTION START ===");

    let chestBlock = await findNearbyChest();

    if (!chestBlock) {
      console.log("  ℹ️  No chest found nearby, placing one...");
      chestBlock = await placeChest();

      if (!chestBlock) {
        console.log("  ⚠️  Could not place chest. Skipping chest interaction.");
        return;
      }
    } else {
      console.log(
        `  ✅ Found chest at (${chestBlock.position.x}, ${chestBlock.position.y}, ${chestBlock.position.z})`,
      );
    }

    const chest = await openChest(chestBlock);

    if (!chest) {
      console.log("  ⚠️  Could not open chest. Skipping interaction.");
      return;
    }

    console.log("\n  📊 Chest contents:");
    const chestItems = chest.containerItems();
    if (chestItems.length === 0) {
      console.log("    (empty)");
    } else {
      chestItems.forEach((item) => {
        console.log(`    - ${item.count}x ${item.name}`);
      });
    }

    if (config.chestInteraction.depositItems) {
      console.log("\n  💼 Depositing items to chest...");
      for (const [itemName, count] of Object.entries(
        config.chestInteraction.depositItems,
      )) {
        await depositItemsToChest(chest, itemName, count);
      }
    }

    if (config.chestInteraction.withdrawItems) {
      console.log("\n  🎒 Withdrawing items from chest...");
      for (const [itemName, count] of Object.entries(
        config.chestInteraction.withdrawItems,
      )) {
        await withdrawItemsFromChest(chest, itemName, count);
      }
    }

    console.log("\n  📊 Final chest contents:");
    const finalItems = chest.containerItems();
    if (finalItems.length === 0) {
      console.log("    (empty)");
    } else {
      finalItems.forEach((item) => {
        console.log(`    - ${item.count}x ${item.name}`);
      });
    }

    chest.close();
    console.log("  🔒 Chest closed");
    console.log("🗄️  === CHEST INTERACTION COMPLETE ===\n");
  } catch (error) {
    console.log(`  ⚠️  Error during chest interaction: ${error.message}`);
  }
}

async function placeAndBreakBlock() {
  const blockType = config.blockType;
  let placedBlockPosition = null;

  try {
    console.log(`  Attempting to place ${blockType} block...`);

    const mcData = require("minecraft-data")(bot.version);
    const blockItem = mcData.itemsByName[blockType];

    if (!blockItem) {
      console.log(`  ⚠️ Block type "${blockType}" not found in game data`);
      return;
    }

    const currentMode = bot.game.gameMode;
    const isCreative = currentMode === 1 || currentMode === 'creative' || String(currentMode).toLowerCase() === 'creative';
    if (isCreative) {
      await ensureItemInCreativeInventory(blockType, 64);
    }

    const itemInInventory = bot.inventory
      .items()
      .find((item) => item.name === blockType);

    if (!itemInInventory) {
      console.log(
        `  ⚠️ No ${blockType} in inventory. Skipping placement.`,
      );
      return;
    }

    console.log(`  Found ${itemInInventory.count} ${blockType} in inventory`);

    await bot.equip(itemInInventory, "hand");
    await delay(100);

    const pos = bot.entity.position.floored();
    const botX = pos.x;
    const botY = pos.y;
    const botZ = pos.z;

    const placementAttempts = [];
    for (let distance = 2; distance <= 4; distance++) {
      placementAttempts.push(
        { pos: new Vec3(botX + distance, botY, botZ), ref: new Vec3(botX + distance, botY - 1, botZ), vec: new Vec3(0, 1, 0), name: `${distance}m east` },
        { pos: new Vec3(botX - distance, botY, botZ), ref: new Vec3(botX - distance, botY - 1, botZ), vec: new Vec3(0, 1, 0), name: `${distance}m west` },
        { pos: new Vec3(botX, botY, botZ + distance), ref: new Vec3(botX, botY - 1, botZ + distance), vec: new Vec3(0, 1, 0), name: `${distance}m south` },
        { pos: new Vec3(botX, botY, botZ - distance), ref: new Vec3(botX, botY - 1, botZ - distance), vec: new Vec3(0, 1, 0), name: `${distance}m north` }
      );
    }

    let placementSuccess = false;

    for (const attempt of placementAttempts) {
      const targetBlock = bot.blockAt(attempt.pos);
      const referenceBlock = bot.blockAt(attempt.ref);

      console.log(
        `  Checking ${attempt.name}: target=${targetBlock?.name || "null"}, ref=${referenceBlock?.name || "null"}`,
      );

      if (targetBlock && targetBlock.name !== "air") {
        console.log(
          `    Skipping ${attempt.name}: target position occupied by ${targetBlock.name}`,
        );
        continue;
      }

      if (!referenceBlock || referenceBlock.name === "air") {
        console.log(`    Skipping ${attempt.name}: no valid reference block`);
        continue;
      }

      try {
        console.log(
          `  Trying to place ${attempt.name} at (${attempt.pos.x}, ${attempt.pos.y}, ${attempt.pos.z}) against ${referenceBlock.name}...`,
        );

        const oldBlockUpdateListener = bot.listeners("blockUpdate").length;
        await bot.placeBlock(referenceBlock, attempt.vec);

        await delay(500);

        const verifyBlock = bot.blockAt(attempt.pos);
        if (
          verifyBlock &&
          verifyBlock.name !== "air" &&
          verifyBlock.name === blockType
        ) {
          console.log(`  ✅ Block placed successfully ${attempt.name}!`);
          placedBlockPosition = attempt.pos;
          placementSuccess = true;
          break;
        } else {
          console.log(
            `  ⚠️ Placement verification failed for ${attempt.name}, found: ${verifyBlock?.name || "null"}`,
          );
        }
      } catch (placeError) {
        console.log(
          `  ⚠️ Failed to place ${attempt.name}: ${placeError.message}`,
        );
        continue;
      }
    }

    if (!placementSuccess) {
      console.log("  ⚠️ Could not find suitable location to place block");
      return;
    }

    await delay(700);

    if (!placedBlockPosition) {
      console.log("  ⚠️ No block position recorded");
      return;
    }

    console.log(
      `  Breaking block at (${placedBlockPosition.x}, ${placedBlockPosition.y}, ${placedBlockPosition.z})...`,
    );
    const placedBlock = bot.blockAt(placedBlockPosition);

    if (!placedBlock || placedBlock.name === "air") {
      console.log("  ⚠️ Block disappeared before breaking");
      return;
    }

    if (!bot.canDigBlock(placedBlock)) {
      console.log(
        `  ⚠️ Cannot dig ${placedBlock.name} (might need tool or permissions)`,
      );
      return;
    }

    try {
      await bot.dig(placedBlock);
      console.log(`  ✅ Block broken successfully!`);

      await delay(200);

      const verifyBroken = bot.blockAt(placedBlockPosition);
      if (verifyBroken && verifyBroken.name === "air") {
        console.log("  ✅ Block breaking verified");
      } else {
        console.log(
          `  ⚠️ Block still exists after breaking: ${verifyBroken ? verifyBroken.name : "unknown"}`,
        );
      }
    } catch (digError) {
      console.log(`  ⚠️ Failed to break block: ${digError.message}`);

      if (digError.message.includes("digging aborted")) {
        console.log("  ℹ️ Digging was interrupted - this is usually okay");
      }
    }
  } catch (error) {
    console.log(
      `  ⚠️ Unexpected error in placeAndBreakBlock: ${error.message}`,
    );
    console.log(
      `  ℹ️ Error details: ${error.stack?.split("\n")[0] || error.toString()}`,
    );
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkAndSwitchToCreative() {
  try {
    currentGamemode = bot.game.gameMode;
    const gamemodes = ['survival', 'creative', 'adventure', 'spectator'];
    const gamemodeName = gamemodes[currentGamemode] || 'unknown';
    
    console.log(`\n🎮 Current gamemode: ${gamemodeName} (value: ${currentGamemode}, type: ${typeof currentGamemode})`);
    
    if (currentGamemode !== 1 && gamemodeName !== 'creative') {
      console.log('  🔄 Switching to creative mode...');
      bot.chat('/gamemode creative');
      
      setTimeout(() => {
        currentGamemode = bot.game.gameMode;
        const newGamemodeName = gamemodes[currentGamemode] || 'unknown';
        console.log(`  📊 New gamemode: ${newGamemodeName} (value: ${currentGamemode})`);
        if (currentGamemode === 1 || newGamemodeName === 'creative') {
          console.log(`  ✅ Successfully switched to creative mode!`);
        } else {
          console.log(`  ⚠️  Still in ${newGamemodeName} mode. May need permissions.`);
        }
      }, 1000);
    } else {
      console.log('  ✅ Already in creative mode!');
    }
  } catch (error) {
    console.log(`  ⚠️  Error checking gamemode: ${error.message}`);
  }
}

function startGamemodeMonitoring() {
  if (gamemodeCheckInterval) {
    clearInterval(gamemodeCheckInterval);
  }

  console.log('🔍 Gamemode monitoring enabled - will auto-switch to creative\n');

  gamemodeCheckInterval = setInterval(() => {
    try {
      const prevGamemode = currentGamemode;
      currentGamemode = bot.game.gameMode;
      
      if (prevGamemode !== null && currentGamemode !== prevGamemode && currentGamemode !== 1) {
        const gamemodes = ['survival', 'creative', 'adventure', 'spectator'];
        const gamemodeName = gamemodes[currentGamemode] || 'unknown';
        console.log(`\n⚠️  Gamemode changed to ${gamemodeName}! Auto-switching to creative...`);
        bot.chat('/gamemode creative');
        
        setTimeout(() => {
          currentGamemode = bot.game.gameMode;
          if (currentGamemode === 1) {
            console.log('  ✅ Switched back to creative mode!\n');
          }
        }, 1000);
      }
    } catch (error) {
      console.log(`  ⚠️  Error monitoring gamemode: ${error.message}`);
    }
  }, 3000);
}

let creativeLock = false;
let lastCreativeSlotUsed = 9;

async function ensureItemInCreativeInventory(itemName, count = 1) {
  while (creativeLock) {
    await delay(300);
  }
  creativeLock = true;
  
  try {
    let actualItemName = itemName;
    if (itemName === 'bed') {
      actualItemName = 'red_bed';
    }
    
    const existingItems = bot.inventory.items().filter(i => i.name === actualItemName);
    const totalCount = existingItems.reduce((sum, item) => sum + item.count, 0);
    
    if (totalCount >= count) {
      creativeLock = false;
      return true;
    }

    const currentMode = bot.game.gameMode;
    const isCreative = currentMode === 1 || currentMode === 'creative' || String(currentMode).toLowerCase() === 'creative';
    
    if (!isCreative) {
      console.log(`  ⚠️  Not in creative mode, cannot get items from creative inventory`);
      creativeLock = false;
      return false;
    }

    const mcData = require("minecraft-data")(bot.version);
    const item = mcData.itemsByName[actualItemName];
    
    if (!item) {
      console.log(`  ⚠️  Item "${actualItemName}" not found in game data`);
      creativeLock = false;
      return false;
    }

    console.log(`  📦 Getting ${count}x ${actualItemName} from creative inventory...`);
    
    let targetSlot = bot.inventory.firstEmptySlotRange(9, 45);
    
    if (targetSlot === null) {
      lastCreativeSlotUsed = (lastCreativeSlotUsed - 9 + 1) % 36 + 9;
      targetSlot = lastCreativeSlotUsed;
    } else {
      lastCreativeSlotUsed = targetSlot;
    }

    try {
      const Item = require('prismarine-item')(bot.version);
      const newItem = new Item(item.id, count);
      
      await bot.creative.setInventorySlot(targetSlot, newItem);
      await delay(1500);
      
      const verifyItems = bot.inventory.items().filter(i => i.name === actualItemName);
      const newTotal = verifyItems.reduce((sum, item) => sum + item.count, 0);
      
      if (newTotal > 0) {
        console.log(`  ✅ Got ${actualItemName} from creative inventory (now have ${newTotal}x)`);
        creativeLock = false;
        return true;
      } else {
        console.log(`  ⚠️  Failed to verify ${actualItemName} in inventory`);
        creativeLock = false;
        return false;
      }
    } catch (error) {
      console.log(`  ⚠️  Creative inventory error: ${error.message}`);
      creativeLock = false;
      return false;
    }
  } catch (error) {
    console.log(`  ⚠️  Error getting item from creative inventory: ${error.message}`);
    creativeLock = false;
    return false;
  }
}

async function checkInventory() {
  console.log("\n🎒 Checking inventory...");
  const items = bot.inventory.items();

  console.log(`Total items in inventory: ${items.length}`);

  const currentMode = bot.game.gameMode;
  const isCreative = currentMode === 1 || currentMode === 'creative' || String(currentMode).toLowerCase() === 'creative';
  
  if (config.requiredInventory) {
    for (const [itemName, requiredCount] of Object.entries(
      config.requiredInventory,
    )) {
      const foundItems = items.filter(
        (item) => item.name === itemName || item.name.includes(itemName),
      );
      const totalCount = foundItems.reduce((sum, item) => sum + item.count, 0);

      if (totalCount >= requiredCount) {
        console.log(`  ✅ ${itemName}: ${totalCount}/${requiredCount}`);
      } else if (totalCount > 0) {
        console.log(
          `  ⚠️  ${itemName}: ${totalCount}/${requiredCount} (need more)`,
        );
        if (isCreative) {
          console.log(`  📦 Getting ${requiredCount - totalCount} more ${itemName} from creative inventory...`);
          await ensureItemInCreativeInventory(itemName, requiredCount);
        }
      } else {
        console.log(`  ❌ ${itemName}: 0/${requiredCount} (MISSING)`);
        if (isCreative) {
          console.log(`  📦 Getting ${requiredCount}x ${itemName} from creative inventory...`);
          await ensureItemInCreativeInventory(itemName, requiredCount);
        }
      }
    }
  }

  console.log("");
}

function isNightTime() {
  if (!bot.time || bot.time.timeOfDay === undefined) return false;
  const timeOfDay = bot.time.timeOfDay;
  return timeOfDay >= 13000 && timeOfDay < 23000;
}

function startNightMonitoring() {
  if (nightCheckInterval) {
    clearInterval(nightCheckInterval);
  }

  console.log(
    "🌙 Night monitoring enabled - bot will sleep immediately when night comes\n",
  );

  nightCheckInterval = setInterval(async () => {
    if (isNightTime() && !isSleeping) {
      console.log("\n🌙 Night has fallen! Sleeping immediately...");
      if (isProcessing) {
        console.log("  ⏸️  Interrupting current activity to sleep");
        bot.pathfinder.setGoal(null);
        isProcessing = false;
      }
      await tryToSleep();
    }
  }, 2000);
}

let lastBedPlacementAttempt = 0;
const BED_PLACEMENT_COOLDOWN = 30000;

async function tryToSleep() {
  if (isSleeping) return;

  try {
    isSleeping = true;
    isProcessing = true;
    bot.pathfinder.setGoal(null);

    const mcData = require("minecraft-data")(bot.version);
    const bedNames = [
      "red_bed",
      "blue_bed",
      "green_bed",
      "yellow_bed",
      "white_bed",
      "black_bed",
      "brown_bed",
      "cyan_bed",
      "gray_bed",
      "light_blue_bed",
      "light_gray_bed",
      "lime_bed",
      "magenta_bed",
      "orange_bed",
      "pink_bed",
      "purple_bed",
    ];

    let bedBlock = bot.findBlock({
      matching: (block) => bedNames.includes(block.name),
      maxDistance: 20,
    });

    if (!bedBlock) {
      const now = Date.now();
      if (now - lastBedPlacementAttempt < BED_PLACEMENT_COOLDOWN) {
        const waitTime = Math.ceil((BED_PLACEMENT_COOLDOWN - (now - lastBedPlacementAttempt)) / 1000);
        console.log(`  ⏰ Bed placement on cooldown. Waiting ${waitTime}s before next attempt.`);
        console.log(`  ⚠️  Skipping sleep for now. Will try again later.`);
        isSleeping = false;
        isProcessing = false;
        return;
      }
      
      lastBedPlacementAttempt = now;
      console.log("  ⚠️  No bed found nearby (searched 20 blocks), attempting to place one...");

      const currentMode = bot.game.gameMode;
      const isCreative = currentMode === 1 || currentMode === 'creative' || String(currentMode).toLowerCase() === 'creative';
      
      if (!isCreative) {
        console.log("  ⚠️  Not in creative mode. Requesting creative mode for bed...");
        bot.chat('/gamemode creative');
        await delay(1000);
      }

      let bedItem = bot.inventory
        .items()
        .find((item) => bedNames.some((name) => item.name.includes("bed")));

      if (!bedItem && isCreative) {
        console.log("  📦 Getting beds from creative inventory...");
        const success = await ensureItemInCreativeInventory("red_bed", 5);
        await delay(500);
        
        if (success) {
          bedItem = bot.inventory
            .items()
            .find((item) => bedNames.some((name) => item.name.includes("bed")));
        }
      }

      if (bedItem) {
        console.log(`  📦 Found ${bedItem.name} x${bedItem.count} in inventory`);
        console.log(`  🔍 Searching for suitable bed placement location...`);

        const pos = bot.entity.position.floored();
        const botX = pos.x;
        const botY = pos.y;
        const botZ = pos.z;

        const placementAttempts = [];
        for (let distance = 2; distance <= 10; distance++) {
          placementAttempts.push(
            { pos: new Vec3(botX + distance, botY, botZ), ref: new Vec3(botX + distance, botY - 1, botZ), name: `${distance}m east` },
            { pos: new Vec3(botX - distance, botY, botZ), ref: new Vec3(botX - distance, botY - 1, botZ), name: `${distance}m west` },
            { pos: new Vec3(botX, botY, botZ + distance), ref: new Vec3(botX, botY - 1, botZ + distance), name: `${distance}m south` },
            { pos: new Vec3(botX, botY, botZ - distance), ref: new Vec3(botX, botY - 1, botZ - distance), name: `${distance}m north` },
            { pos: new Vec3(botX + distance, botY, botZ + distance), ref: new Vec3(botX + distance, botY - 1, botZ + distance), name: `${distance}m SE` },
            { pos: new Vec3(botX - distance, botY, botZ - distance), ref: new Vec3(botX - distance, botY - 1, botZ - distance), name: `${distance}m NW` },
            { pos: new Vec3(botX + distance, botY, botZ - distance), ref: new Vec3(botX + distance, botY - 1, botZ - distance), name: `${distance}m NE` },
            { pos: new Vec3(botX - distance, botY, botZ + distance), ref: new Vec3(botX - distance, botY - 1, botZ + distance), name: `${distance}m SW` }
          );
        }

        let bedPlaced = false;
        let attemptCount = 0;

        for (const attempt of placementAttempts) {
          attemptCount++;
          const targetBlock = bot.blockAt(attempt.pos);
          const referenceBlock = bot.blockAt(attempt.ref);
          const aboveBlock = bot.blockAt(new Vec3(attempt.pos.x, attempt.pos.y + 1, attempt.pos.z));

          if (!targetBlock || !referenceBlock || !aboveBlock) continue;

          if (targetBlock.name === "air" && aboveBlock.name === "air" && referenceBlock.name !== "air" && !referenceBlock.name.includes("bed")) {
            try {
              console.log(`  🔨 Attempt ${attemptCount}: Placing bed ${attempt.name}...`);
              await bot.equip(bedItem, "hand");
              await delay(300);

              await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
              console.log(`  ✅ Bed placed ${attempt.name} at (${attempt.pos.x}, ${attempt.pos.y}, ${attempt.pos.z})!`);
              bedPlaced = true;

              await delay(800);
              bedBlock = bot.findBlock({
                matching: (block) => bedNames.includes(block.name),
                maxDistance: 15,
              });
              
              if (bedBlock) {
                console.log(`  ✅ Bed confirmed at position (${bedBlock.position.x}, ${bedBlock.position.y}, ${bedBlock.position.z})`);
              }
              break;
            } catch (err) {
              console.log(`  ⚠️  Failed to place bed ${attempt.name}: ${err.message}`);
            }
          }
        }

        if (!bedPlaced) {
          console.log("  ❌ Could not find a suitable location to place bed within 10 blocks");
          console.log("  🔄 Trying to clear space and place bed...");
          
          const clearPos = new Vec3(botX + 3, botY, botZ);
          const blockToClear = bot.blockAt(clearPos);
          
          if (blockToClear && blockToClear.name !== "air" && bot.canDigBlock(blockToClear)) {
            try {
              await bot.dig(blockToClear);
              await delay(500);
              await bot.equip(bedItem, "hand");
              await delay(300);
              const refBlock = bot.blockAt(new Vec3(clearPos.x, clearPos.y - 1, clearPos.z));
              await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
              console.log(`  ✅ Bed placed after clearing space!`);
              bedPlaced = true;
              await delay(500);
              bedBlock = bot.findBlock({
                matching: (block) => bedNames.includes(block.name),
                maxDistance: 15,
              });
            } catch (err) {
              console.log(`  ⚠️  Failed to clear and place: ${err.message}`);
            }
          }
        }
      } else {
        console.log("  ❌ No bed in inventory even after getting from creative!");
        console.log("  ⚠️  Skipping bed placement. Will try again later.");
        isSleeping = false;
        isProcessing = false;
        return;
      }
    }

    if (bedBlock) {
      console.log(
        `  🛏️  Found bed at (${bedBlock.position.x}, ${bedBlock.position.y}, ${bedBlock.position.z})`,
      );

      const distance = bot.entity.position.distanceTo(bedBlock.position);
      if (distance > 3) {
        console.log(`  🚶 Walking to bed (${distance.toFixed(1)} blocks away)...`);
        const goal = new goals.GoalBlock(
          bedBlock.position.x,
          bedBlock.position.y,
          bedBlock.position.z,
        );
        bot.pathfinder.setGoal(goal);

        await new Promise((resolve) => {
          const checkArrival = setInterval(() => {
            const currentDistance = bot.entity.position.distanceTo(
              bedBlock.position,
            );
            if (currentDistance < 4) {
              clearInterval(checkArrival);
              bot.pathfinder.setGoal(null);
              resolve();
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkArrival);
            bot.pathfinder.setGoal(null);
            resolve();
          }, 15000);
        });
        
        await delay(500);
      }

      console.log("  💤 Attempting to sleep...");
      
      let sleepAttempts = 0;
      let sleepSuccess = false;
      
      while (sleepAttempts < 3 && !sleepSuccess) {
        sleepAttempts++;
        try {
          console.log(`  🛏️  Sleep attempt ${sleepAttempts}/3...`);
          await bot.sleep(bedBlock);
          console.log("  ✅ Bot is now sleeping. Will wake when morning comes.");
          sleepSuccess = true;

          bot.once("wake", () => {
            console.log("  ☀️  Good morning! Bot has woken up.");
            isSleeping = false;
            isProcessing = false;

            setTimeout(() => {
              console.log("  🔄 Resuming circular walking pattern...\n");
              startCircularPattern();
            }, 2000);
          });
        } catch (error) {
          console.log(`  ⚠️  Sleep attempt ${sleepAttempts} failed: ${error.message}`);
          
          if (error.message.includes("too far away")) {
            console.log("  🚶 Moving closer to bed...");
            const goal = new goals.GoalNear(
              bedBlock.position.x,
              bedBlock.position.y,
              bedBlock.position.z,
              1
            );
            bot.pathfinder.setGoal(goal);
            await delay(2000);
            bot.pathfinder.setGoal(null);
          } else if (error.message.includes("monsters nearby") || error.message.includes("not safe")) {
            console.log("  ⚠️  Area not safe, waiting a moment...");
            await delay(2000);
          } else if (error.message.includes("occupied")) {
            console.log("  ⚠️  Bed occupied, trying to find another bed...");
            bedBlock = bot.findBlock({
              matching: (block) => bedNames.includes(block.name) && !block.position.equals(bedBlock.position),
              maxDistance: 64,
            });
            if (!bedBlock) {
              console.log("  ⚠️  No other bed found, will continue without sleep");
              break;
            }
          } else if (sleepAttempts < 3) {
            console.log("  🔄 Waiting before retry...");
            await delay(1000);
          }
        }
      }
      
      if (!sleepSuccess) {
        console.log("  ⚠️  Could not sleep after 3 attempts. Continuing without sleep.");
        isSleeping = false;
        isProcessing = false;
        setTimeout(() => startCircularPattern(), 2000);
      }
    } else {
      console.log("  ⚠️  No bed available even after placement attempts. Continuing without sleep.");
      isSleeping = false;
      isProcessing = false;
      setTimeout(() => startCircularPattern(), 2000);
    }
  } catch (error) {
    console.log(`  ⚠️  Error during sleep attempt: ${error.message}`);
    console.log(`  📊 Error stack: ${error.stack?.split("\n").slice(0, 2).join("\n")}`);
    isSleeping = false;
    isProcessing = false;
    setTimeout(() => startCircularPattern(), 2000);
  }
}

process.on("SIGINT", () => {
  console.log("\nShutting down bot...");
  if (nightCheckInterval) {
    clearInterval(nightCheckInterval);
  }
  if (gamemodeCheckInterval) {
    clearInterval(gamemodeCheckInterval);
  }
  bot.quit();
  process.exit(0);
});
