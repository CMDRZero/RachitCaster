/* 
GLOBALS
----------
*/

// Screen dimensions (scale to 85% of the screen window)
var screenWidth = int(window.innerWidth * .85);
var screenHeight = int(window.innerHeight * .85);

var scaleFactor = 2;
var downscaledWidth = int(screenWidth / scaleFactor);
var downscaledHeight = int(screenHeight / scaleFactor);

// Dealing with canvas (setting dimensions, creating context)
canvas.width = screenWidth;
canvas.height = screenHeight;

var ctx = canvas.getContext("2d");
var screen = ctx.createImageData(screenWidth, screenHeight); // Create an image data object to draw pixels to

// Window control width (75% of the screen window minus 9.5px of padding)
document.getElementById("window-controls").style.width = (canvas.width - 9.5).toString() + 'px';

// Instruction prompt animation, includes everything needed to render the animated prompt at the beginning (calculated based on screen dimensions)
var prompt_ = "CLICK TO LOCK MOUSE CURSOR. ARROW KEYS OR WASD TO MOVE."
var promptY = -20;
var speed = 75;
var promptX = screenWidth / 2 - 5 * prompt_.length;
var rectX = promptX - 2.5;
var rectY = promptY - 20;
var rectWidth = 10.5 * prompt_.length;
var rectHeight = 25;
var maxHeight = 35;
var showPrompt = true;

// Variables needed for delta time calculation
var now;
var lastUpdate;
var deltaTime;

// World representation
function generateMaze(mazeWidth, mazeHeight) {
    if (mazeWidth !== mazeHeight || mazeHeight % 2 !== 1) // Constraints to make the algorithm simple
        return "Error: Size must be odd and square!"

    // Generate maze as a 2D array: 1 = WALL and 0 = SPACE
    // The maze starts as a solid block filled with ones.
    let maze = [];
    for (let x = 0; x < mazeWidth; x++) {
        let row = [];
        for (let y = 0; y < mazeHeight; y++) {
            row.push(1);
        }
        maze.push(row);
    }

    // Use the binary tree maze generation algorithm to carve out spaces in the block generated earlier
    // The algorithm runs on everything except the two columns on the right and rows on the bottom
    for (let x = 1; x < mazeWidth-2; x += 2) { // Increment by 2 to modify every other value
                                               // This is done to allow "walls" to exist in-between cells
        for (let y = 1; y < mazeHeight-2; y += 2) {
            maze[x][y] = 0; // Carve out this value by setting it to 0
            
            let direction; // Choose a direction to carve out another wall and create a pathway
            if (x === 1 && y === 1) // If this is the top left cell where the player is, set the direction to the right so the player is not facing a wall
                direction = 0;
            else
                direction = Math.floor(Math.random() * 2); // Otherwise, choose a random direction
            if (direction === 0) // Carve out the right wall
                maze[x+1][y] = 0;
            if (direction === 1) // Carve out the bottom wall
                maze[x][y+1] = 0;
        }
    }

    // Empty out every cell in the right-most and bottom-most corrider in order to make sure every area of the maze is accesible. 
    // The width and height are subtracted by 1 in order to create a boundary around the outside of the maze.
    for (let y = 1; y < mazeHeight-1; y++)
        maze[mazeWidth-2][y] = 0; 
    for (let x = 1; x < mazeWidth-1; x++)
        maze[x][mazeHeight-2] = 0; 

    /*
    VISUAL DEMONSTRATION
    --------------------------
    1. Solid Square 2D Array of Blocks
    #########
    #########
    #########
    #########
    #########
    #########
    #########
    #########
    #########
    
    2. Carve Out Every Other Block (Except The Two Right Columns and Two Bottom Rows)
    #########
    # # # ###
    #########
    # # # ###
    #########
    # # # ###
    #########
    # # # ###
    #########

    3. At The Same Time, Choose A Random Direction (Right Or Down) To Carve Out A Pathway For Each Of These Blocks 
    #########                         #########
    # ^ # ^##                         #   #  ##
    ###^#####                         ### #####
    # ^ # ###                         #   # ###
    ###^#^### ----------------------> ### # ###
    # ^ # ###                         #   # ###
    #####^###                         ##### ###
    #########                         #########
    #########                         #########
    ^ = Chosen cells to carve out

    4. Carve Out The Right-most Column And Bottom-most Row
    #########
    #   #   #
    ### ### #
    #   # # #
    ### # # #
    #   # # #
    ##### # #
    #       #
    #########

    And Bam! We have a maze!
    */

    return maze;
}

const mapWidth = 25;
const mapHeight = 25;
const map = generateMaze(mapWidth, mapHeight); // 25 x 25 procedural maze

// Minimap and crosshair values (calculated based on screen dimensions)
var blockSize = int(screenWidth / 120);
var crosshairSizeShort = int(blockSize / 6);
var crosshairSizeLong = int(crosshairSizeShort * 12);
var padding = int(blockSize / 2);
var playerSize = int(padding * 4/5);

// Player
const MOVE_SPEED = 3.25;
// const ROTATION_SPEED = 1.25;

var position = new Vector2(1.5, 1.5);
var direction = new Vector2(1, 0);
var plane = new Vector2(0, 0.66);
var walkTime = 0.0;
var pitch = 0.0;

// Input and key handling
var keyRight = false;
var keyLeft = false;
var keyUp = false;
var keyDown = false;

document.addEventListener("keydown", keyPush);
document.addEventListener("keyup", keyReleased);
canvas.addEventListener("click", async () => {
    if(!document.pointerLockElement) {
      await canvas.requestPointerLock({
        unadjustedMovement: true,
      });
    }

    if (showPrompt)
        showPrompt = false;
});
document.addEventListener("pointerlockchange", lockChangeAlert, false);

function lockChangeAlert() {
    if (document.pointerLockElement === canvas) {
        console.log("The pointer lock status is now locked");
        document.addEventListener("mousemove", rotatePlayer, false);
    } else {
        console.log("The pointer lock status is now unlocked");
        document.removeEventListener("mousemove", rotatePlayer, false);
    }
}  

function keyPush(event) {
    if (event.repeat)
        return
    switch(event.key) {
        case "ArrowRight":
        case "d":
            keyRight = true;
            break;
        case "ArrowLeft":
        case "a":
            keyLeft = true;
            break;

        case "ArrowUp":
        case "w":
            keyUp = true;
            break;
        case "ArrowDown":
        case "s":
            keyDown = true;
            break;
    }
}

function keyReleased(event) {
    if (event.repeat)
        return
    switch(event.key) {
        case "ArrowRight":
        case "d":
            keyRight = false;
            break;
        case "ArrowLeft":
        case "a":
            keyLeft = false;
            break;

        case "ArrowUp":
        case "w":
            keyUp = false;
            break;
        case "ArrowDown":
        case "s":
            keyDown = false;
            break;
    }
}

// Movement
function movePlayer(moveSpeed) {
    let moved = false;

    if (keyRight) {
        var newPosition = new Vector2(position.x + (plane.x * moveSpeed), position.y + (plane.y * moveSpeed));
        if (map[int(newPosition.x)][int(position.y)] === 0)
            position.x = newPosition.x;
        if (map[int(position.x)][int(newPosition.y)] === 0) 
            position.y = newPosition.y;

        moved = true;
    }

    if (keyLeft) {
        var newPosition = new Vector2(position.x - (plane.x * moveSpeed), position.y - (plane.y * moveSpeed));
        if (map[int(newPosition.x)][int(position.y)] === 0)
            position.x = newPosition.x;
        if (map[int(position.x)][int(newPosition.y)] === 0) 
            position.y = newPosition.y;

        moved = true;
    }

    if (keyUp) {
        var newPosition = new Vector2(position.x + (direction.x * moveSpeed), position.y + (direction.y * moveSpeed));
        if (map[int(newPosition.x)][int(position.y)] === 0)
            position.x = newPosition.x;
        if (map[int(position.x)][int(newPosition.y)] === 0) 
            position.y = newPosition.y;

        moved = true;
    }

    if (keyDown) {
        var newPosition = new Vector2(position.x - (direction.x * moveSpeed), position.y - (direction.y * moveSpeed));
        if (map[int(newPosition.x)][int(position.y)] === 0)
            position.x = newPosition.x;
        if (map[int(position.x)][int(newPosition.y)] === 0) 
            position.y = newPosition.y;
        
        moved = true;
    }

    if (moved) {
        walkTime += deltaTime;
        pitch += (Math.cos(10 * walkTime) / 2 * 3.5);
    }
}

function rotatePlayer(event) {
    let differenceX = event.movementX / screenWidth;
    let differenceY = event.movementY / screenHeight;
    let rotationSpeedX = (differenceX * 45) * deltaTime;
    let rotationSpeedY = -(differenceY * 10000) * deltaTime;

    var newDirection = new Vector2();
    newDirection.x = direction.x * Math.cos(rotationSpeedX) - direction.y * Math.sin(rotationSpeedX);
    newDirection.y = direction.x * Math.sin(rotationSpeedX) + direction.y * Math.cos(rotationSpeedX);
    direction = newDirection;

    var newPlane = new Vector2();
    newPlane.x = plane.x * Math.cos(rotationSpeedX) - plane.y * Math.sin(rotationSpeedX);
    newPlane.y = plane.x * Math.sin(rotationSpeedX) + plane.y * Math.cos(rotationSpeedX);
    plane = newPlane;

    pitch += rotationSpeedY;
}

// Sprite structure
function Sprite(x, y, texture) {
    this.x = x;
    this.y = y;
}

// Main loop
function main() {
    // Calculate delta time
    now = Date.now();
    deltaTime = (now - lastUpdate) / 1000;
    lastUpdate = now;

    // Use delta time to calculate a smooth movement speed based on framerate
    let moveSpeed = MOVE_SPEED * deltaTime;
    // let rotationSpeed = ROTATION_SPEED * deltaTime;
    movePlayer(moveSpeed);
    
    let clipPitch = 150;
    if (downscaledHeight / 2 < 150) 
        clipPitch = downscaledHeight / 2;
    if (pitch < -clipPitch)
        pitch = -clipPitch;
    if (pitch > clipPitch)
        pitch = clipPitch;
    
    // Draw floor and ceiling (Horizontally)
    /*
    let leftRayDirection = new Vector2(direction.x - plane.x, direction.y - plane.y);
    let rightRayDirection = new Vector2(direction.x + plane.x, direction.y + plane.y);
    for (let y = 0; y < screenHeight; y++) {
        let p = y - screenHeight / 2;
        let posZ = 0.5 * screenHeight;
        let rowDistance = posZ / p;

        let floorStep = new Vector2(rowDistance * (rightRayDirection.x - leftRayDirection.x) / screenWidth, 
                                rowDistance * (rightRayDirection.y - leftRayDirection.y) / screenWidth); 
        let floor = new Vector2(position.x + rowDistance * leftRayDirection.x, position.y + rowDistance * leftRayDirection.y);

        let dimFactor = 0.8 + (((screenHeight - y - 1) / 5) * 0.01);

        for (let x = 0; x < screenWidth; x++) {
            let cell = new Vector2(int(floor.x), int(floor.y));
            let textureCoords = new Vector2(int(textureWidth * (floor.x - cell.x)) & (textureWidth - 1),
                                            int(textureHeight * (floor.y - cell.y)) & (textureHeight - 1));

            floor.x += floorStep.x;
            floor.y += floorStep.y;
            
            let pixelindex = (textureCoords.y * textureWidth + textureCoords.x) * 4;
            let red = groundTexture.data[pixelindex] / dimFactor;
            let green = groundTexture.data[pixelindex+1] / dimFactor;
            let blue = groundTexture.data[pixelindex+2] / dimFactor;

            drawPixel(screen, x, y, red, green, blue);
            drawPixel(screen, x, screenHeight - y - 1, 0 / dimFactor, 191 / dimFactor, 255 / dimFactor);
        }
    }
    */

    // drawRectangle(screen, 0, 0, screenWidth, screenHeight / 2 + pitch * 2, 0, 191, 255);
    // drawRectangle(screen, 0, screenHeight / 2, screenWidth, screenHeight, 72, 171, 62);

    for (let y = 0; y < screenHeight / 2 + pitch * scaleFactor; y++) {
        let dimFactor = mapValue(y, 0, downscaledHeight, 0.8, 2);
        drawLine(screen, new Vector2(0, y), new Vector2(screenWidth, y), 45 / dimFactor, 45 / dimFactor, 45 / dimFactor);
    }
    
    let raysOnMap = [];
    for (let x = 0; x < downscaledWidth; x++) {
        let cameraX = 2 * x / downscaledWidth - 1;
        let rayDirection = new Vector2(direction.x + plane.x * cameraX, direction.y + plane.y * cameraX);
        
        let mapCoords = new Vector2(int(position.x), int(position.y));
        let sideDistance = new Vector2();
        let deltaDistance = new Vector2(
            // (rayDirection.x === 0) ? 1e+30 : Math.abs(1 / rayDirection.x),
            // (rayDirection.y === 0) ? 1e+30 : Math.abs(1 / rayDirection.y)
            Math.abs(1 / rayDirection.x),
            Math.abs(1 / rayDirection.y)
        );

        var step = new Vector2();
        let hit = false;
        let side;

        if (rayDirection.x < 0) {
          step.x = -1;
          sideDistance.x = (position.x - mapCoords.x) * deltaDistance.x;
        }
        else {
          step.x = 1;
          sideDistance.x = (mapCoords.x + 1 - position.x) * deltaDistance.x;
        }
        if (rayDirection.y < 0) {
          step.y = -1;
          sideDistance.y = (position.y - mapCoords.y) * deltaDistance.y;
        }
        else {
          step.y = 1;
          sideDistance.y = (mapCoords.y + 1 - position.y) * deltaDistance.y;
        }

        // DDA raycasting loop
        while (!hit) {
            if (sideDistance.x < sideDistance.y) {
                sideDistance.x += deltaDistance.x;
                mapCoords.x += step.x;
                side = 0;
            }

            else {
                sideDistance.y += deltaDistance.y;
                mapCoords.y += step.y;
                side = 1;
            }

            // Collision with wall
            if (map[mapCoords.x][mapCoords.y] > 0) 
                hit = true;
        }

        let perpendicularWallDistance;
        if (side === 0)
            perpendicularWallDistance = (sideDistance.x - deltaDistance.x);
        else
            perpendicularWallDistance = (sideDistance.y - deltaDistance.y);

        if (x % 2 == 0) {
            let rayOnMap = new Vector2(((position.x + (rayDirection.x * perpendicularWallDistance)) * blockSize) + (screenWidth - mapWidth * blockSize - padding),
                                    (position.y + (rayDirection.y * perpendicularWallDistance)) * blockSize + padding);        
            raysOnMap.push(rayOnMap);
        }
        
        let lineHeight = int(downscaledHeight / perpendicularWallDistance);
        let drawStart = downscaledHeight / 2 - lineHeight / 2 + pitch;
        if (drawStart < 0)
            drawStart = 0;
        let drawEnd = downscaledHeight / 2 + lineHeight / 2 + pitch;
        if (drawEnd >= downscaledHeight)  
            drawEnd = downscaledHeight - 1;

        let wallX;
        if (side === 0)
            wallX = position.y + perpendicularWallDistance * rayDirection.y;
        else
            wallX = position.x + perpendicularWallDistance * rayDirection.x;
        wallX -= Math.floor(wallX);

        let textureCoords = new Vector2();
        textureCoords.x = int(wallX * textureWidth);
        if (side === 0 && rayDirection.x > 0)
            textureCoords.x = textureWidth - textureCoords.x - 1;
        if (side === 1 && rayDirection.y < 0)
            textureCoords.x = textureWidth - textureCoords.x - 1;

        var step = 1.0 * textureHeight / lineHeight;
        let texturePosition = (drawStart - pitch - downscaledHeight / 2 + lineHeight / 2) * step;
        for (let y = int(drawStart); y < int(drawEnd); y++) {
            textureCoords.y = int(texturePosition) & (textureHeight - 1);
            texturePosition += step;

            let dimFactor = 0.8 + (0.2 * (perpendicularWallDistance));
            /*
            // Calculate the lighting of the texture based on the height of the line being rendered (which is based off of distance)
            let nearness;
            if (lineHeight > 100) // If the line is bigger than a 100 pixels, make it full brightness
                nearness = 100;
            else
                nearness = lineHeight;

            // Add 0.01 to the "dimness factor" for every pixel in the difference between the line height and a 100 pixels
            let dimFactor = 0.8 + (0.01 * (100 - nearness)); // Make the max "dimness factor" 0.8 so it is slightly brighter than the actual texture
            */
            /*
            let dimFactor = 0.8;
            let temp = dimFactor;
            for (let i = 100; i >= 0; i -= 1) {
                temp += 0.01;
                if (lineHeight < i)
                    dimFactor = temp;
            }
            */
            
            // Divide the actual pixel values of the texture by this "dimmess factor" to make it dimmer or brighter
            pixelindex = (textureCoords.y * textureWidth + textureCoords.x) * 4;
            let red = wallTexture.data[pixelindex] / dimFactor;
            let green = wallTexture.data[pixelindex+1] / dimFactor;
            let blue = wallTexture.data[pixelindex+2] / dimFactor;

            drawRectangle(screen, x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor, red, green, blue);
        }

        // Draw Wall and Ceiling (Vertically)
        let floorWallPos = new Vector2();
        if(side == 0 && rayDirection.x > 0) {
            floorWallPos.x = mapCoords.x;
            floorWallPos.y = mapCoords.y + wallX;
        }
        else if(side == 0 && rayDirection.x < 0) {
            floorWallPos.x = mapCoords.x + 1.0;
            floorWallPos.y = mapCoords.y + wallX;
        }
        else if(side == 1 && rayDirection.y > 0) {
            floorWallPos.x = mapCoords.x + wallX;
            floorWallPos.y = mapCoords.y;
        }
        else {
            floorWallPos.x = mapCoords.x + wallX;
            floorWallPos.y = mapCoords.y + 1.0;
        }

        let currentDistance = 0.0;

        if (drawEnd < 0) 
            drawEnd = downscaledHeight;

        for (let y = downscaledHeight; y > drawEnd-1; y--) {
            currentDistance = downscaledHeight / (2.0 * (y - pitch) - downscaledHeight);
    
            let weight = currentDistance / perpendicularWallDistance;
            
            let currentFloor = new Vector2(weight * floorWallPos.x + (1.0 - weight) * position.x,
                                          weight * floorWallPos.y + (1.0 - weight) * position.y)
    
            let floorTex = new Vector2(int(currentFloor.x * textureWidth) % textureWidth,
                                       int(currentFloor.y * textureHeight) % textureHeight);

            let dimFactor = 0.9 + (0.2 * (currentDistance));
            let pixelindex = (floorTex.y * textureWidth + floorTex.x) * 4;
            let red = groundTexture.data[pixelindex] / dimFactor;
            let green = groundTexture.data[pixelindex+1] / dimFactor;
            let blue = groundTexture.data[pixelindex+2] / dimFactor;

            drawRectangle(screen, x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor, red, green, blue);
        }
    }

    // Render minimap
    drawRectangle(screen, (screenWidth - mapWidth * blockSize - padding), padding, mapWidth * blockSize, mapHeight * blockSize, 66, 66, 66);
    let adjustedPosition = new Vector2((position.x * blockSize) + (screenWidth - mapWidth * blockSize - padding),
                                       position.y * blockSize + padding); 
    drawFilledCircle(screen, adjustedPosition.x, adjustedPosition.y, playerSize, 255, 92, 92);
    raysOnMap.forEach(rayOnMap =>
        drawLine(screen, adjustedPosition, rayOnMap, 255, 92, 92)
    );
    for (let x = 0; x < mapWidth; x++) {
        for (let y = 0; y < mapHeight; y++) {
            if (map[x][y] > 0)
                drawRectangle(screen, (x * blockSize) + (screenWidth - mapWidth * blockSize - padding), y * blockSize + padding, blockSize - 1, blockSize - 1, 255, 255, 255);                
        }
    }

    // Render crosshair
    drawRectangle(screen, screenWidth / 2, screenHeight / 2 - 9, 2, 20, 255, 255, 255);
    drawRectangle(screen, screenWidth / 2 - 10 + 1, screenHeight / 2, 20, 2, 255, 255, 255);
    
    ctx.putImageData(screen, 0, 0);

    ctx.font = "17px Helvetica";
    if (showPrompt) {
        ctx.fillStyle = "white";
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        ctx.fillStyle = "black";
        ctx.fillText(prompt_, promptX, promptY);
        if (promptY < maxHeight) {
            promptY += int(speed * deltaTime);
            rectY += int(speed * deltaTime);
        }
    }

    else {
        ctx.font = "18px Helvetica";
        ctx.fillStyle = "white";
        ctx.fillText(`${(1 / deltaTime).toFixed(3)} FPS`, 5, 25);
    }

    requestAnimationFrame(main);
}

// Textures
const textureWidth = 64;
const textureHeight = 64;
const textureUrls = ['textures/bricks.png', 'textures/tiles.png'];

loadImages(textureUrls).then(textures => {
    ctx.drawImage(textures[0], 0, 0);
    wallTexture = ctx.getImageData(0, 0, textureWidth, textureHeight);

    ctx.drawImage(textures[1], 0, 0);
    groundTexture = ctx.getImageData(0, 0, textureWidth, textureHeight);

    spriteArray = [
        Sprite(20.5, 11.5, '')
    ]
    
    requestAnimationFrame(main);
});