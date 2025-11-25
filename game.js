// Maya's Veggie Run - JavaScript Version
// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loadingScreen = document.getElementById('loadingScreen');

// Game constants
const SCREEN_WIDTH = 1200;
const SCREEN_HEIGHT = 720;

// Responsive canvas scaling
function resizeCanvas() {
    const gameRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;

    let newWidth, newHeight;

    if (windowRatio > gameRatio) {
        // Window is wider than game - fit to height
        newHeight = windowHeight - 10;
        newWidth = newHeight * gameRatio;
    } else {
        // Window is taller than game - fit to width
        newWidth = windowWidth - 10;
        newHeight = newWidth / gameRatio;
    }

    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
}

// Call on load and resize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
});
const GROUND_Y =433; // Adjusted so Maya's feet align with the foreground ground
const GRAVITY = 0.6; // Lower gravity for longer hang time
const JUMP_STRENGTH = -17; // Higher jump (+40 pixels)

// Game state
let gameActive = false;
let gameSpeed = 3.25;
let score = 0;
let foodCollected = 0;
let bossActive = false;
let bossHealth = 3;
let hugActive = false;
let hugTimer = 0;
let hurtTimer = 0; // Timer for hurt animation
let pauseTimer = 0; // Pause game to show animations
let confetti = []; // Confetti particles for hug celebration
let hugAnimFrame = 0; // Animation frame for hug text

// Confetti colors - bright and fun for kids!
const CONFETTI_COLORS = ['#ff69b4', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#ff85a2', '#00d4ff'];

// Spawn confetti burst
function spawnConfetti(amount) {
    for (let i = 0; i < amount; i++) {
        confetti.push({
            x: SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 300,
            y: 80 + Math.random() * 50,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * -4 - 2,
            size: Math.random() * 12 + 6,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 15,
            shape: Math.random() > 0.5 ? 'rect' : 'circle',
            gravity: 0.15
        });
    }
}

// Update confetti particles
function updateConfetti() {
    for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Remove if off screen
        if (p.y > SCREEN_HEIGHT + 50) {
            confetti.splice(i, 1);
        }
    }
}

// Draw confetti
function drawConfetti(ctx) {
    confetti.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

// Player state
let player = {
    x: 100,
    y: GROUND_Y,
    width: 120,
    height: 160,
    velocityY: 0,
    jumping: false,
    health: 100,
    frameIndex: 0,
    animationSpeed: 0.1,
    currentRow: 1 // Start with walk cycle (row 1)
};

// Arrays for game objects
let objects = [];
let spawnTimer = 0;

// Background scrolling
let bgX1 = 0;
let bgX2 = SCREEN_WIDTH * 1.08 - 5; // -5 overlap to prevent gap
const bgScrollSpeed = 1.3;

// Foreground scrolling
let fgX1 = 0;
let fgX2 = SCREEN_WIDTH * 1.08 - 5; // -5 overlap to prevent gap
const fgScrollSpeed = 1.95;
const fgYOffset = -57; // Position foreground so ground aligns properly

// Asset loading
let assetsLoaded = 0;
const totalAssets = 17; // 9 original + 8 additional food sprites
const images = {};
const foodImages = []; // Array to hold all food sprite variations

// Audio
const sounds = {
    jump: null,
    collect: null,
    hit: null,
    love: null,
    gameOver: null,
    music: null
};

// Sprite sheet configuration
const spriteConfig = {
    maya: { rows: 7, cols: 5, frameWidth: 0, frameHeight: 0, currentRow: 1 }, // Use row 1 for walk cycle
    food: { rows: 1, cols: 1, frameWidth: 0, frameHeight: 0 }, // Single sprite
    obstacle: { rows: 1, cols: 1, frameWidth: 0, frameHeight: 0 },
    unicorn: { rows: 1, cols: 5, frameWidth: 0, frameHeight: 0 },
    elmo: { rows: 1, cols: 5, frameWidth: 0, frameHeight: 0 },
    pet: { rows: 2, cols: 5, frameWidth: 0, frameHeight: 0, currentRow: 0 }, // Row 0 = sleeping, row 1 = awake/hug
    elmo_sad: { rows: 3, cols: 4, frameWidth: 0, frameHeight: 0 }
};

// Load images
function loadImage(name, src) {
    const img = new Image();
    img.onload = () => {
        // Calculate frame dimensions for sprite sheets
        if (spriteConfig[name]) {
            spriteConfig[name].frameWidth = img.width / spriteConfig[name].cols;
            spriteConfig[name].frameHeight = img.height / spriteConfig[name].rows;
        }
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            startGame();
        }
    };
    img.onerror = () => {
        console.warn(`Failed to load ${name}, using placeholder`);
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            startGame();
        }
    };
    img.src = src;
    return img;
}

// Load audio
function loadAudio(src) {
    const audio = new Audio();
    audio.src = src;
    audio.onerror = () => {
        console.warn(`Failed to load audio: ${src}`);
    };
    return audio;
}

// Load assets
images.bg = loadImage('bg', './assets/images/bg.png');
images.fg = loadImage('fg', './assets/images/fg.png');
images.maya = loadImage('maya', './assets/images/mayaSprite.png');
// Load all food sprite variations
for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
        const foodImg = loadImage(`food_r${r}_c${c}`, `./assets/images/sprite_r${r}_c${c}.png`);
        foodImages.push(foodImg);
    }
}
images.obstacle = loadImage('obstacle', './assets/images/rock.png');
images.unicorn = loadImage('unicorn', './assets/images/unicorn_processed.png');
images.elmo = loadImage('elmo', './assets/images/elmo_processed.png');
images.pet = loadImage('pet', './assets/images/pet_sleeping.png');
images.elmo_sad = loadImage('elmo_sad', './assets/images/elmo_sad_processed.png');

// Load sounds
sounds.jump = loadAudio('./assets/sounds/jump.ogg');
sounds.collect = loadAudio('./assets/sounds/collect.ogg');
sounds.hit = loadAudio('./assets/sounds/hit.ogg');
sounds.love = loadAudio('./assets/sounds/love.ogg');
sounds.gameOver = loadAudio('./assets/sounds/game_over.ogg');
sounds.music = loadAudio('./assets/sounds/big_and_strong.mp3');
if (sounds.music) {
    sounds.music.loop = true;
    sounds.music.volume = 0.5; // Background music at 50% volume
}

// Input handling
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameActive) {
            jump();
        } else {
            restartGame();
        }
    }
});
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Mobile touch and click support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling and zooming
    if (gameActive) {
        jump();
    } else {
        restartGame();
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('click', (e) => {
    if (gameActive) {
        jump();
    } else {
        restartGame();
    }
});

// Prevent context menu on long press
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Jump function
function jump() {
    if (!player.jumping) {
        player.velocityY = JUMP_STRENGTH;
        player.jumping = true;

        // Try to start music on first user interaction
        if (sounds.music && sounds.music.paused) {
            sounds.music.play().catch(e => console.warn('Could not play music'));
        }

        // Play jump sound
        if (sounds.jump) {
            sounds.jump.currentTime = 0;
            sounds.jump.play().catch(e => console.warn('Could not play jump sound'));
        }
    }
}

// Spawn objects
function spawnObject() {
    const rng = Math.random() * 100;
    let type, width, height, speed, frameIndex = 0;

    if (rng <= 25) {
        // 25% - Obstacle (rocks)
        type = 'obstacle';
        width = 70;
        height = 70;
        speed = gameSpeed;
    } else if (rng <= 65) {
        // 40% - Food
        type = 'food';
        width = 70;
        height = 70;
        speed = gameSpeed;
    } else if (rng <= 85) {
        // 20% - Pet (puppy)
        type = 'pet';
        width = 125;
        height = 125;
        speed = gameSpeed;
    } else if (rng <= 97) {
        // 12% - Unicorn (faster)
        type = 'unicorn';
        width = 120;
        height = 120;
        speed = gameSpeed + 3;
    } else {
        // 5% - Floating Elmo
        type = 'elmo';
        width = 50;
        height = 50;
        speed = gameSpeed - 1;
    }

    // Objects should align with Maya's feet (bottom edge)
    let y = GROUND_Y + player.height - height;
    if (type === 'food') {
        // Some food at ground level, some mid-air, some high up
        const heightRoll = Math.random();
        if (heightRoll < 0.4) {
            y = GROUND_Y + player.height - height - Math.random() * 50; // Low food
        } else if (heightRoll < 0.7) {
            y = GROUND_Y + player.height - height - 80 - Math.random() * 60; // Mid food
        } else {
            y = GROUND_Y + player.height - height - 140 - Math.random() * 80; // High food - need to jump!
        }
    }
    // All other objects (obstacles, pets, unicorns, elmo) spawn at ground level

    objects.push({
        type,
        x: SCREEN_WIDTH + Math.random() * 100,
        y,
        width,
        height,
        speed,
        frameIndex,
        animationSpeed: 0.1,
        bobOffset: 0,
        bobSpeed: 0.05,
        collected: false, // For pet - track if already collected
        currentRow: type === 'pet' ? 0 : undefined, // Pet starts with sleeping animation (row 0)
        foodImageIndex: type === 'food' ? Math.floor(Math.random() * foodImages.length) : undefined // Random food sprite
    });
}

// Spawn boss
function spawnBoss() {
    objects.push({
        type: 'boss',
        x: SCREEN_WIDTH - 200, // Start on right side of screen
        y: GROUND_Y + player.height - 120, // Align with Maya's ground level
        width: 120, // Larger boss sprite
        height: 120, // Larger boss sprite
        speed: 4, // Horizontal movement speed
        direction: -1, // -1 = left, 1 = right
        frameIndex: 0,
        animationSpeed: 0.1,
        health: 3, // Takes 3 hits to defeat (one per animation row)
        currentRow: 0, // Track which animation row to use
        hitCooldown: 0 // Cooldown timer to prevent rapid hits
    });
}

// Update game state
function update() {
    if (!gameActive) return;

    // Update pause timer FIRST - before any physics or movement
    if (pauseTimer > 0) {
        pauseTimer--;
        // During pause, still update animations but don't move objects or spawn new ones
        player.frameIndex += player.animationSpeed;
        if (player.frameIndex >= spriteConfig.maya.cols) {
            player.frameIndex = 0;
        }

        // Update object animations during pause
        objects.forEach(obj => {
            obj.frameIndex += obj.animationSpeed;
            const config = spriteConfig[obj.type === 'boss' ? 'elmo_sad' : obj.type];
            if (config && obj.frameIndex >= config.cols) {
                obj.frameIndex = 0;
            }
        });

        return; // Skip rest of update during pause
    }

    // Update hurt timer
    if (hurtTimer > 0) {
        hurtTimer--;
        if (hurtTimer === 0 && player.currentRow === 6) {
            player.currentRow = 1; // Back to walk cycle after hurt animation
        }
    }

    // Reset to walk cycle after pause ends (if was celebrating)
    if (pauseTimer === 0 && player.currentRow === 5) {
        player.currentRow = 1; // Back to walk cycle after celebration
    }

    // Update background scrolling
    bgX1 -= bgScrollSpeed;
    bgX2 -= bgScrollSpeed;
    if (bgX1 <= -SCREEN_WIDTH * 1.08) bgX1 = SCREEN_WIDTH * 1.08 - 5;
    if (bgX2 <= -SCREEN_WIDTH * 1.08) bgX2 = SCREEN_WIDTH * 1.08 - 5;

    // Update foreground scrolling
    fgX1 -= fgScrollSpeed;
    fgX2 -= fgScrollSpeed;
    if (fgX1 <= -SCREEN_WIDTH * 1.08) fgX1 = SCREEN_WIDTH * 1.08 - 5;
    if (fgX2 <= -SCREEN_WIDTH * 1.08) fgX2 = SCREEN_WIDTH * 1.08 - 5;

    // Update player physics
    player.velocityY += GRAVITY;
    player.y += player.velocityY;

    // Ground collision
    if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.velocityY = 0;
        player.jumping = false;
    }

    // Update animation
    player.frameIndex += player.animationSpeed;
    if (player.frameIndex >= spriteConfig.maya.cols) {
        player.frameIndex = 0;
    }

    // Update hug timer and animation
    if (hugActive) {
        hugTimer--;
        hugAnimFrame++;
        // Spawn more confetti periodically
        if (hugTimer % 20 === 0) {
            spawnConfetti(10);
        }
        if (hugTimer <= 0) {
            hugActive = false;
        }
    }

    // Always update confetti (even after hug ends, let them fall)
    updateConfetti();

    // Spawn boss at 5 veggies
    if (foodCollected >= 5 && !bossActive) {
        bossActive = true;
        spawnBoss();
    }

    // Spawn objects (not during boss)
    if (!bossActive) {
        spawnTimer++;
        if (spawnTimer > Math.max(30, 100 - Math.floor(score / 5))) {
            spawnTimer = 0;
            spawnObject();
        }
    }

    // Update objects
    objects.forEach((obj, index) => {
        // Special movement for boss - pan left and right
        if (obj.type === 'boss') {
            obj.x += obj.speed * obj.direction;

            // Bounce off screen edges
            if (obj.x <= 0) {
                obj.direction = 1; // Move right
            } else if (obj.x + obj.width >= SCREEN_WIDTH) {
                obj.direction = -1; // Move left
            }

            // Update hit cooldown
            if (obj.hitCooldown > 0) {
                obj.hitCooldown--;
            }
        } else {
            // Normal scrolling for other objects
            obj.x -= obj.speed;
        }

        // Update animation
        obj.frameIndex += obj.animationSpeed;
        const config = spriteConfig[obj.type === 'boss' ? 'elmo_sad' : obj.type];
        if (config && obj.frameIndex >= config.cols) {
            obj.frameIndex = 0;
        }

        // Bobbing motion for floating elmo
        if (obj.type === 'elmo') {
            obj.bobOffset += obj.bobSpeed;
            obj.y += Math.sin(obj.bobOffset) * 2;
        }

        // Check collision with player
        if (checkCollision(player, obj)) {
            if (obj.type === 'food') {
                player.health = Math.min(100, player.health + 5);
                score++;
                foodCollected++;
                objects.splice(index, 1);
                // Play collect sound
                if (sounds.collect) {
                    sounds.collect.currentTime = 0;
                    sounds.collect.play().catch(e => console.warn('Could not play collect sound'));
                }
            } else if (obj.type === 'obstacle') {
                player.health -= 2;
                player.currentRow = 6; // Show hurt animation (row 6)
                player.frameIndex = 0;
                hurtTimer = 15; // Show hurt animation briefly
                objects.splice(index, 1);
                // Play hit sound
                if (sounds.hit) {
                    sounds.hit.currentTime = 0;
                    sounds.hit.play().catch(e => console.warn('Could not play hit sound'));
                }
            } else if (obj.type === 'pet' && !obj.collected) {
                // Hug mechanic - puppy wakes up and jumps for a hug!
                player.health = 100; // Full heal
                player.currentRow = 5; // Show celebrating animation (row 5)
                player.frameIndex = 0;
                hugActive = true;
                hugTimer = 180; // Show message for 3 seconds
                hugAnimFrame = 0; // Reset animation
                spawnConfetti(50); // Big confetti burst!
                pauseTimer = 150; // Pause for 2.5 seconds to show animation multiple times
                obj.currentRow = 1; // Switch to awake/hug animation (row 1)
                obj.frameIndex = 0; // Reset animation to start
                obj.collected = true; // Mark as collected to prevent re-collision
                // Play love sound
                if (sounds.love) {
                    sounds.love.currentTime = 0;
                    sounds.love.play().catch(e => console.warn('Could not play love sound'));
                }
            } else if (obj.type === 'unicorn') {
                // Check if Maya is bouncing on top of the unicorn (generous hit zone)
                if (player.velocityY > 0 && player.y + player.height <= obj.y + obj.height * 0.75) {
                    // Bounce off the unicorn - it keeps running!
                    player.velocityY = JUMP_STRENGTH * 1.0; // Strong bounce
                    player.health = Math.min(100, player.health + 5); // Small heal
                    // Play collect sound for bounce
                    if (sounds.collect) {
                        sounds.collect.currentTime = 0;
                        sounds.collect.play().catch(e => console.warn('Could not play collect sound'));
                    }
                } else {
                    // Side collision - take damage
                    player.health -= 5;
                    player.currentRow = 6; // Show hurt animation (row 6)
                    player.frameIndex = 0;
                    hurtTimer = 15; // Show hurt animation briefly
                    objects.splice(index, 1);
                    // Play hit sound
                    if (sounds.hit) {
                        sounds.hit.currentTime = 0;
                        sounds.hit.play().catch(e => console.warn('Could not play hit sound'));
                    }
                }
            } else if (obj.type === 'elmo') {
                // Floating Elmo collision
                player.health -= 3;
                player.currentRow = 6; // Show hurt animation (row 6)
                player.frameIndex = 0;
                hurtTimer = 15; // Show hurt animation briefly
                objects.splice(index, 1);
                // Play hit sound
                if (sounds.hit) {
                    sounds.hit.currentTime = 0;
                    sounds.hit.play().catch(e => console.warn('Could not play hit sound'));
                }
            } else if (obj.type === 'boss') {
                // Boss collision - only damage from top when not in cooldown
                if (player.jumping && player.velocityY > 0 && player.y + player.height <= obj.y + obj.height && obj.hitCooldown === 0) {
                    // Hit boss from top (larger hit zone - full boss height)
                    obj.health--;
                    obj.hitCooldown = 180; // 3 second cooldown
                    player.velocityY = JUMP_STRENGTH * 0.5; // Bounce

                    // Change animation row based on hits (3 health -> 2 health -> 1 health)
                    if (obj.health === 2) {
                        obj.currentRow = 1; // Switch to rolling animation (row 1)
                        obj.frameIndex = 0;
                    } else if (obj.health === 1) {
                        obj.currentRow = 2; // Switch to sad animation (row 2)
                        obj.frameIndex = 0;
                    }

                    // Play hit sound
                    if (sounds.hit) {
                        sounds.hit.currentTime = 0;
                        sounds.hit.play().catch(e => console.warn('Could not play hit sound'));
                    }

                    if (obj.health <= 0) {
                        objects.splice(index, 1);
                        bossActive = false;
                        foodCollected = 0; // Reset veggie count after defeating boss
                        player.health = Math.min(100, player.health + 20);
                        player.currentRow = 5; // Show celebrating animation (row 5)
                        player.frameIndex = 0;
                        hugActive = true;
                        hugTimer = 90;
                        pauseTimer = 60; // Pause to celebrate victory
                        // Play love sound for victory
                        if (sounds.love) {
                            sounds.love.currentTime = 0;
                            sounds.love.play().catch(e => console.warn('Could not play love sound'));
                        }
                    }
                } else if (obj.hitCooldown === 0) {
                    // Hit boss from side - take damage (only when not in cooldown)
                    player.health -= 5;
                    player.currentRow = 6; // Show hurt animation (row 6)
                    player.frameIndex = 0;
                    hurtTimer = 15; // Show hurt animation briefly
                    obj.hitCooldown = 30; // Brief cooldown to prevent rapid damage
                    // Play hit sound
                    if (sounds.hit) {
                        sounds.hit.currentTime = 0;
                        sounds.hit.play().catch(e => console.warn('Could not play hit sound'));
                    }
                }
            }
        }

        // Remove off-screen objects (but not boss - he stays on screen)
        if (obj.x < -100 && obj.type !== 'boss') {
            if (obj.type === 'food') {
                gameSpeed += 0.5; // Missed food makes game harder
            }
            objects.splice(index, 1);
        }

        // Remove collected pets after pause ends
        if (obj.type === 'pet' && obj.collected && pauseTimer === 0) {
            objects.splice(index, 1);
        }
    });

    // Check game over
    if (player.health <= 0) {
        gameActive = false;
        // Stop music and play game over sound
        if (sounds.music) {
            sounds.music.pause();
        }
        if (sounds.gameOver) {
            sounds.gameOver.currentTime = 0;
            sounds.gameOver.play().catch(e => console.warn('Could not play game over sound'));
        }
    }
}

// Collision detection
function checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// Draw functions
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Draw background (parallax) - draw wider to prevent gaps
    if (images.bg.complete) {
        ctx.drawImage(images.bg, bgX1, -15, SCREEN_WIDTH * 1.08 + 5, SCREEN_HEIGHT * 1.08);
        ctx.drawImage(images.bg, bgX2, -15, SCREEN_WIDTH * 1.08 + 5, SCREEN_HEIGHT * 1.08);
    } else {
        // Fallback gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F6FF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    // Draw foreground (parallax) - draw wider to prevent gaps
    if (images.fg.complete) {
        ctx.drawImage(images.fg, fgX1, fgYOffset, SCREEN_WIDTH * 1.08 + 5, SCREEN_HEIGHT * 1.08);
        ctx.drawImage(images.fg, fgX2, fgYOffset, SCREEN_WIDTH * 1.08 + 5, SCREEN_HEIGHT * 1.08);
    }

    // Draw player (Maya sprite)
    if (images.maya.complete && spriteConfig.maya.frameWidth > 0) {
        const frameX = Math.floor(player.frameIndex) * spriteConfig.maya.frameWidth;
        const frameY = player.currentRow * spriteConfig.maya.frameHeight;
        ctx.drawImage(
            images.maya,
            frameX, frameY,
            spriteConfig.maya.frameWidth, spriteConfig.maya.frameHeight,
            player.x, player.y,
            player.width, player.height
        );
    } else {
        // Fallback
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Draw objects
    objects.forEach(obj => {
        // Special handling for food - use random food image
        if (obj.type === 'food' && obj.foodImageIndex !== undefined) {
            const foodImg = foodImages[obj.foodImageIndex];
            if (foodImg && foodImg.complete) {
                ctx.drawImage(foodImg, obj.x, obj.y, obj.width, obj.height);
            } else {
                ctx.fillStyle = '#4ecca3';
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            }
            return;
        }

        const imageName = obj.type === 'boss' ? 'elmo' : obj.type;
        const image = images[imageName];
        const config = spriteConfig[imageName];

        if (image && image.complete && config && config.frameWidth > 0) {
            // Draw sprite
            let frameX = Math.floor(obj.frameIndex) * config.frameWidth;
            let frameY = 0;

            // For boss with different health, change sprite and row
            let spriteImage = image;
            let spriteConfig_local = config;

            if (obj.type === 'boss') {
                const bossConfig = spriteConfig.elmo_sad;
                spriteImage = images.elmo_sad;
                spriteConfig_local = bossConfig;

                // Recalculate frameX with correct config (4 columns, not 5)
                frameX = Math.floor(obj.frameIndex) * bossConfig.frameWidth;
                // Use currentRow to select animation row
                frameY = obj.currentRow * bossConfig.frameHeight;
            } else if (obj.currentRow !== undefined) {
                // Use object's current row (for pet animation changes)
                frameY = obj.currentRow * config.frameHeight;
            } else if (config.currentRow !== undefined) {
                // Use config default row
                frameY = config.currentRow * config.frameHeight;
            }

            // Flip unicorn horizontally
            if (obj.type === 'unicorn') {
                ctx.save();
                ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
                ctx.scale(-1, 1);
                ctx.drawImage(
                    spriteImage,
                    frameX, frameY,
                    spriteConfig_local.frameWidth, spriteConfig_local.frameHeight,
                    -obj.width / 2, -obj.height / 2,
                    obj.width, obj.height
                );
                ctx.restore();
            } else {
                ctx.drawImage(
                    spriteImage,
                    frameX, frameY,
                    spriteConfig_local.frameWidth, spriteConfig_local.frameHeight,
                    obj.x, obj.y,
                    obj.width, obj.height
                );
            }
        } else {
            // Fallback rectangles
            if (obj.type === 'food') {
                ctx.fillStyle = '#4ecca3';
            } else if (obj.type === 'boss') {
                ctx.fillStyle = '#ff0000';
            } else if (obj.type === 'pet') {
                ctx.fillStyle = '#ffaa00';
            } else if (obj.type === 'unicorn') {
                ctx.fillStyle = '#ff69b4';
            } else if (obj.type === 'elmo') {
                ctx.fillStyle = '#ff5555';
            } else {
                ctx.fillStyle = '#555';
            }
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
    });

    // Draw UI
    ctx.fillStyle = '#000';
    ctx.font = '24px Arial';
    ctx.fillText(`Energy: ${Math.floor(player.health)}%`, 10, 30);
    ctx.fillText(`Speed: ${gameSpeed.toFixed(1)}`, 10, 60);
    ctx.fillText(`Veggies: ${foodCollected}`, 10, 90);

    // Draw confetti (behind text)
    drawConfetti(ctx);

    // Draw fancy animated hug indicator
    if (hugActive) {
        ctx.save();
        ctx.textAlign = 'center';

        // Bouncy scale animation
        const bounce = 1 + Math.sin(hugAnimFrame * 0.15) * 0.15;
        const wobble = Math.sin(hugAnimFrame * 0.1) * 3;

        ctx.translate(SCREEN_WIDTH / 2, 100);
        ctx.rotate(wobble * Math.PI / 180);
        ctx.scale(bounce, bounce);

        // Rainbow gradient text
        const gradient = ctx.createLinearGradient(-150, 0, 150, 0);
        const hueShift = hugAnimFrame * 3;
        gradient.addColorStop(0, `hsl(${(hueShift) % 360}, 100%, 60%)`);
        gradient.addColorStop(0.25, `hsl(${(hueShift + 60) % 360}, 100%, 60%)`);
        gradient.addColorStop(0.5, `hsl(${(hueShift + 120) % 360}, 100%, 60%)`);
        gradient.addColorStop(0.75, `hsl(${(hueShift + 180) % 360}, 100%, 60%)`);
        gradient.addColorStop(1, `hsl(${(hueShift + 240) % 360}, 100%, 60%)`);

        // Glow effect (multiple shadows)
        ctx.shadowColor = '#ff69b4';
        ctx.shadowBlur = 20 + Math.sin(hugAnimFrame * 0.2) * 10;

        // Big sparkly text
        ctx.font = 'bold 56px Comic Sans MS, cursive, sans-serif';
        ctx.fillStyle = gradient;
        ctx.fillText('HUG!', 0, 0);

        // White outline for pop
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.strokeText('HUG!', 0, 0);

        // Floating hearts around text
        const heartEmojis = ['💖', '💕', '💗', '💝', '✨', '🌟', '⭐'];
        for (let i = 0; i < 6; i++) {
            const angle = (hugAnimFrame * 0.05) + (i * Math.PI / 3);
            const radius = 80 + Math.sin(hugAnimFrame * 0.1 + i) * 20;
            const hx = Math.cos(angle) * radius;
            const hy = Math.sin(angle) * radius * 0.5 - 10;
            ctx.font = '28px Arial';
            ctx.shadowBlur = 0;
            ctx.fillText(heartEmojis[i % heartEmojis.length], hx, hy);
        }

        ctx.restore();
        ctx.textAlign = 'left';
    }

    // Draw boss indicator
    if (bossActive) {
        const boss = objects.find(obj => obj.type === 'boss');
        if (boss) {
            ctx.fillStyle = '#ff0000';
            ctx.font = '28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`LOVE ELMO - Health: ${boss.health}/3`, SCREEN_WIDTH / 2, 50);
            ctx.fillText('Jump on his head!', SCREEN_WIDTH / 2, 80);
            ctx.textAlign = 'left';
        }
    }

    // Draw game over screen
    if (!gameActive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('OUT OF ENERGY!', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);

        ctx.font = '24px Arial';
        ctx.fillText('Press SPACE or TAP to try again', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 50);
        ctx.textAlign = 'left';
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    loadingScreen.classList.add('hidden');
    restartGame();
    gameLoop();
    // Start background music
    if (sounds.music) {
        sounds.music.play().catch(e => {
            console.warn('Could not autoplay music. User interaction may be required.');
        });
    }
}

// Restart game
function restartGame() {
    gameActive = true;
    player.health = 100;
    player.y = GROUND_Y;
    player.velocityY = 0;
    player.jumping = false;
    player.frameIndex = 0;
    player.currentRow = 1; // Reset to walk cycle
    gameSpeed = 5;
    score = 0;
    foodCollected = 0;
    objects = [];
    spawnTimer = 0;
    bossActive = false;
    bossHealth = 3;
    hugActive = false;
    hugTimer = 0;
    hugAnimFrame = 0;
    confetti = [];
    hurtTimer = 0;
    pauseTimer = 0;
    bgX1 = 0;
    bgX2 = SCREEN_WIDTH * 1.08 - 5;
    fgX1 = 0;
    fgX2 = SCREEN_WIDTH * 1.08 - 5;

    // Restart background music
    if (sounds.music) {
        sounds.music.currentTime = 0;
        sounds.music.play().catch(e => console.warn('Could not play music'));
    }
}
