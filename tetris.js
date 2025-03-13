// 游戏常量
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    null,
    '#00f0f0', // I - 青色
    '#f0f000', // O - 黄色
    '#a000f0', // T - 紫色
    '#00f000', // S - 绿色
    '#f00000', // Z - 红色
    '#0000f0', // J - 蓝色
    '#f0a000'  // L - 橙色
];

// 渐变颜色
const GRADIENTS = [
    null,
    'linear-gradient(135deg, #00f0f0, #00c0c0)', // I
    'linear-gradient(135deg, #f0f000, #d0d000)', // O
    'linear-gradient(135deg, #a000f0, #8000c0)', // T
    'linear-gradient(135deg, #00f000, #00c000)', // S
    'linear-gradient(135deg, #f00000, #c00000)', // Z
    'linear-gradient(135deg, #0000f0, #0000c0)', // J
    'linear-gradient(135deg, #f0a000, #d08000)'  // L
];

// 方块形状定义
const SHAPES = [
    null,
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[2, 2], [2, 2]], // O
    [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
    [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
    [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
    [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
    [[0, 0, 7], [7, 7, 7], [0, 0, 0]]  // L
];

// 获取DOM元素
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const comboElement = document.getElementById('combo');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const nextPieceDisplay = document.getElementById('next-piece-display');
const holdPieceDisplay = document.getElementById('hold-piece-display');
const nextPiece1Display = document.getElementById('next-piece-1');
const nextPiece2Display = document.getElementById('next-piece-2');
const nextPiece3Display = document.getElementById('next-piece-3');
const gameOverlay = document.getElementById('game-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayMessage = document.getElementById('overlay-message');

// 设置画布大小 - 确保在小屏幕上也能正常显示
const setCanvasSize = () => {
    // 确保BLOCK_SIZE适应不同屏幕尺寸
    let screenFactor = Math.min(window.innerWidth / 800, 1); // 800px是参考宽度
    let actualBlockSize = Math.floor(BLOCK_SIZE * screenFactor);
    
    // 确保块大小不会小于一定值
    actualBlockSize = Math.max(actualBlockSize, 20); 
    
    canvas.width = COLS * actualBlockSize;
    canvas.height = ROWS * actualBlockSize;
    ctx.scale(actualBlockSize, actualBlockSize);
};

// 初始设置画布大小
setCanvasSize();

// 窗口大小改变时重新设置画布大小
window.addEventListener('resize', () => {
    // 保存当前游戏状态
    const wasRunning = !paused && !gameOver && piece !== null;
    if (wasRunning) {
        togglePause(); // 暂停游戏
    }
    
    // 重设画布
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置缩放
    setCanvasSize();
    
    // 重新渲染
    draw();
    
    // 如果游戏正在运行，继续游戏
    if (wasRunning) {
        setTimeout(() => {
            togglePause(); // 恢复游戏
        }, 300);
    }
});

// 游戏状态
let board = createBoard();
let gameOver = false;
let paused = false;
let requestId = null;
let score = 0;
let level = 1;
let lines = 0;
let combo = 0;
let dropCounter = 0;
let dropInterval = 1000; // 方块下落间隔（毫秒）
let lastTime = 0;
let piece = null;
let pieceQueue = []; // 七包随机系统的方块队列
let holdPiece = null; // 保留的方块
let holdUsed = false; // 是否已使用保留功能（每次落块后重置）
let ghostPiece = null; // 幽灵方块（显示方块将落到何处）
let highScore = localStorage.getItem('tetris-high-score') || 0;

// 初始化游戏板
function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 重置游戏
function resetGame() {
    board = createBoard();
    gameOver = false;
    paused = false;
    score = 0;
    level = 1;
    lines = 0;
    combo = 0;
    dropInterval = 1000;
    updateScore();
    
    if (requestId) {
        cancelAnimationFrame(requestId);
        requestId = null;
    }
    
    piece = null;
    pieceQueue = []; // 清空方块队列
    holdPiece = null;
    holdUsed = false;
    ghostPiece = null;
    
    // 生成初始的七包随机方块
    generateBag();
    
    // 隐藏游戏结束覆盖层
    gameOverlay.classList.add('hidden');
    
    // 清空保留方块显示
    clearHoldDisplay();
}

// 七包随机系统 - 生成一个包含所有7种方块的乱序包
function generateBag() {
    // 生成包含1-7的数组（对应7种方块）
    const bag = [1, 2, 3, 4, 5, 6, 7];
    
    // 使用Fisher-Yates洗牌算法打乱数组
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]]; // 交换元素
    }
    
    // 将生成的乱序包添加到队列末尾
    pieceQueue.push(...bag);
}

// 从队列中获取下一个方块
function getNextPiece() {
    // 如果队列中的方块不足，生成新的一包
    if (pieceQueue.length < 7) {
        generateBag();
    }
    
    // 从队列中取出第一个方块
    const id = pieceQueue.shift();
    const shape = SHAPES[id];
    
    return {
        id: id,
        shape: shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0
    };
}

// 生成下一个方块
function generateNextPiece() {
    // 第一次运行时，确保队列已初始化
    if (pieceQueue.length === 0) {
        generateBag();
    }
    
    // 设置新的当前方块
    piece = getNextPiece();
    
    // 更新幽灵方块
    updateGhostPiece();
    
    // 重置保留方块使用状态
    holdUsed = false;
    
    // 渲染预览
    drawNextPieces();
    
    // 检查游戏是否结束
    if (checkCollision(piece)) {
        gameOver = true;
        showGameOver();
    }
}

// 保留方块功能
function holdPieceFunction() {
    // 如果已经使用了保留功能，则不允许再次使用
    if (holdUsed || !piece) return;
    
    // 播放音效
    playSound('hold');
    
    if (holdPiece === null) {
        // 第一次使用保留功能
        holdPiece = {
            id: piece.id,
            shape: SHAPES[piece.id]
        };
        
        // 从队列中获取新方块
        piece = getNextPiece();
    } else {
        // 交换当前方块和保留方块
        const tempPiece = {
            id: holdPiece.id,
            shape: SHAPES[holdPiece.id],
            x: Math.floor(COLS / 2) - Math.floor(SHAPES[holdPiece.id][0].length / 2),
            y: 0
        };
        
        holdPiece = {
            id: piece.id,
            shape: SHAPES[piece.id]
        };
        
        piece = tempPiece;
    }
    
    // 标记已使用保留功能
    holdUsed = true;
    
    // 更新显示
    drawHoldPiece();
    updateGhostPiece();
}

// 清空保留方块显示
function clearHoldDisplay() {
    holdPieceDisplay.innerHTML = '';
    
    // 创建4x4网格
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.classList.add('preview-cell');
            holdPieceDisplay.appendChild(cell);
        }
    }
    
    // 标记为禁用状态
    holdPieceDisplay.classList.add('disabled');
}

// 绘制保留方块
function drawHoldPiece() {
    // 清空保留区域
    holdPieceDisplay.innerHTML = '';
    
    if (holdPiece === null) {
        clearHoldDisplay();
        return;
    }
    
    // 移除禁用状态
    holdPieceDisplay.classList.remove('disabled');
    
    // 如果当前已使用保留功能，添加禁用样式
    if (holdUsed) {
        holdPieceDisplay.classList.add('disabled');
    } else {
        holdPieceDisplay.classList.remove('disabled');
    }
    
    // 创建4x4网格
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.classList.add('preview-cell');
            
            // 判断是否属于保留方块
            if (holdPiece.shape[y] && holdPiece.shape[y][x] > 0) {
                const pieceId = holdPiece.shape[y][x];
                cell.style.background = GRADIENTS[pieceId];
                cell.style.boxShadow = 'inset 0 0 5px rgba(255, 255, 255, 0.5)';
                cell.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
            
            holdPieceDisplay.appendChild(cell);
        }
    }
}

// 绘制迷你预览方块
function drawMiniPreview(pieceId, container) {
    // 清空预览区域
    container.innerHTML = '';
    
    const shape = SHAPES[pieceId];
    
    // 创建预览网格
    for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.classList.add('preview-cell');
            
            // 判断是否属于方块
            if (shape[y] && shape[y][x] > 0) {
                const id = shape[y][x];
                cell.style.background = GRADIENTS[id];
                cell.style.boxShadow = 'inset 0 0 5px rgba(255, 255, 255, 0.5)';
                cell.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
            
            container.appendChild(cell);
        }
    }
}

// 更新幽灵方块
function updateGhostPiece() {
    if (!piece) return;
    
    // 创建幽灵方块副本
    ghostPiece = {
        ...piece,
        shape: JSON.parse(JSON.stringify(piece.shape))
    };
    
    // 将幽灵方块直接落到底部
    while (!checkCollision({ ...ghostPiece, y: ghostPiece.y + 1 })) {
        ghostPiece.y += 1;
    }
}

// 绘制下一个方块预览
function drawNextPieces() {
    // 确保队列中有足够的方块用于预览
    while (pieceQueue.length < 4) {
        generateBag();
    }
    
    // 绘制主预览区域（下一个方块）
    // 清空预览区域
    nextPieceDisplay.innerHTML = '';
    
    const nextShape = SHAPES[pieceQueue[0]];
    
    // 创建4x4网格
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.classList.add('preview-cell');
            
            // 判断是否属于下一个方块
            if (nextShape[y] && nextShape[y][x] > 0) {
                const pieceId = nextShape[y][x];
                cell.style.background = GRADIENTS[pieceId];
                cell.style.boxShadow = 'inset 0 0 5px rgba(255, 255, 255, 0.5)';
                cell.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
            
            nextPieceDisplay.appendChild(cell);
        }
    }
    
    // 绘制后续预览
    drawMiniPreview(pieceQueue[1], nextPiece1Display);
    drawMiniPreview(pieceQueue[2], nextPiece2Display);
    drawMiniPreview(pieceQueue[3], nextPiece3Display);
}

// 绘制游戏板
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制网格
    drawGrid();
    
    // 绘制幽灵方块
    if (ghostPiece && !gameOver && !paused) {
        drawGhostPiece();
    }
    
    // 绘制已固定的方块
    drawBoard();
    
    // 绘制当前下落的方块
    if (piece) {
        drawPiece();
    }
}

// 绘制网格
function drawGrid() {
    ctx.lineWidth = 0.02;
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.1)';
    
    // 绘制垂直线
    for (let i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, ROWS);
        ctx.stroke();
    }
    
    // 绘制水平线
    for (let i = 1; i < ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(COLS, i);
        ctx.stroke();
    }
}

// 绘制幽灵方块
function drawGhostPiece() {
    if (!ghostPiece) return;
    
    const { shape, x, y, id } = ghostPiece;
    
    ctx.globalAlpha = 0.3; // 透明度
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] > 0) {
                ctx.fillStyle = COLORS[id];
                ctx.fillRect(x + c, y + r, 1, 1);
                
                // 添加虚线边框
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.strokeRect(x + c, y + r, 1, 1);
            }
        }
    }
    
    ctx.globalAlpha = 1.0; // 恢复透明度
}

// 绘制当前游戏板
function drawBoard() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] > 0) {
                const colorIdx = board[y][x];
                
                // 创建渐变填充
                const gradient = ctx.createLinearGradient(x, y, x + 1, y + 1);
                gradient.addColorStop(0, COLORS[colorIdx]);
                gradient.addColorStop(1, shadeColor(COLORS[colorIdx], -20));
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, 1, 1);
                
                // 添加高光效果
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(x, y, 1, 0.3);
                
                // 添加边框
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 0.05;
                ctx.strokeRect(x, y, 1, 1);
            }
        }
    }
}

// 辅助函数：改变颜色明度
function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

// 绘制当前下落方块
function drawPiece() {
    const { shape, x, y, id } = piece;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] > 0) {
                // 创建渐变填充
                const gradient = ctx.createLinearGradient(x + c, y + r, x + c + 1, y + r + 1);
                gradient.addColorStop(0, COLORS[id]);
                gradient.addColorStop(1, shadeColor(COLORS[id], -20));
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x + c, y + r, 1, 1);
                
                // 添加高光效果
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(x + c, y + r, 1, 0.3);
                
                // 添加边框
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 0.05;
                ctx.strokeRect(x + c, y + r, 1, 1);
            }
        }
    }
}

// 更新分数显示
function updateScore() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
    comboElement.textContent = combo;
    
    // 更新最高分
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetris-high-score', highScore);
    }
}

// 显示游戏结束覆盖层
function showGameOver() {
    overlayTitle.textContent = '游戏结束';
    overlayScore.textContent = `得分: ${score}`;
    
    if (score > 0 && score === highScore) {
        overlayMessage.textContent = '恭喜！你创造了新的最高分！按"开始游戏"重新开始。';
    } else {
        overlayMessage.textContent = `最高分: ${highScore} | 按"开始游戏"重新开始。`;
    }
    
    gameOverlay.classList.remove('hidden');
}

// 显示暂停覆盖层
function showPaused() {
    overlayTitle.textContent = '游戏暂停';
    overlayScore.textContent = '';
    overlayMessage.textContent = '按"暂停"按钮继续游戏';
    gameOverlay.classList.remove('hidden');
}

// 隐藏覆盖层
function hideOverlay() {
    gameOverlay.classList.add('hidden');
}

// 检查碰撞
function checkCollision(p) {
    const { shape, x, y } = p;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] > 0) {
                const newX = x + c;
                const newY = y + r;
                
                // 检查边界
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                // 检查碰到已固定的方块
                if (newY >= 0 && board[newY][newX] > 0) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// 旋转方块
function rotate(p) {
    // 创建方块的副本
    const clone = JSON.parse(JSON.stringify(p));
    
    // 转置矩阵
    for (let y = 0; y < clone.shape.length; y++) {
        for (let x = 0; x < y; x++) {
            [clone.shape[x][y], clone.shape[y][x]] = [clone.shape[y][x], clone.shape[x][y]];
        }
    }
    
    // 反转每一行
    clone.shape.forEach(row => row.reverse());
    
    return clone;
}

// 墙踢（Wall Kick）逻辑
function wallKick(p) {
    // 基本偏移量测试，按SRS规则
    const offsets = [
        {x: 0, y: 0},  // 不移动
        {x: -1, y: 0}, // 左移
        {x: 1, y: 0},  // 右移
        {x: 0, y: -1}, // 上移
        {x: -1, y: -1}, // 左上
        {x: 1, y: -1},  // 右上
        {x: -2, y: 0}, // 左移2格
        {x: 2, y: 0},  // 右移2格
        {x: 0, y: -2}, // 上移2格
    ];
    
    for (const offset of offsets) {
        const kickedPiece = {
            ...p,
            x: p.x + offset.x,
            y: p.y + offset.y
        };
        
        if (!checkCollision(kickedPiece)) {
            return kickedPiece;
        }
    }
    
    return null; // 所有偏移测试都失败
}

// 固定当前方块到游戏板
function freeze() {
    const { shape, x, y, id } = piece;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] > 0) {
                const boardY = y + r;
                
                // 如果超出顶部边界，游戏结束
                if (boardY < 0) {
                    gameOver = true;
                    showGameOver();
                    return;
                }
                
                board[boardY][x + c] = id;
            }
        }
    }
    
    // 播放锁定音效
    playSound('lock');
    
    // 检查是否有完整的行
    checkLines();
    
    // 生成新方块
    generateNextPiece();
}

// 移动方块
function movePiece(dir) {
    const newX = piece.x + dir;
    const newPiece = { ...piece, x: newX };
    
    if (!checkCollision(newPiece)) {
        piece = newPiece;
        updateGhostPiece();
        
        // 播放移动音效
        playSound('move');
    }
}

// 旋转方块操作
function rotatePiece() {
    const rotated = rotate(piece);
    const kicked = wallKick(rotated);
    
    if (kicked) {
        piece = kicked;
        updateGhostPiece();
        
        // 播放旋转音效
        playSound('rotate');
    }
}

// 下落方块
function dropPiece() {
    const newY = piece.y + 1;
    const newPiece = { ...piece, y: newY };
    
    if (!checkCollision(newPiece)) {
        piece = newPiece;
        
        // 软降得分
        score += 1;
        updateScore();
    } else {
        freeze();
    }
    
    dropCounter = 0;
}

// 硬降（立即落到底部）
function hardDrop() {
    while (!checkCollision({ ...piece, y: piece.y + 1 })) {
        piece.y += 1;
        score += 2; // 硬降每下降一格得2分
    }
    
    // 播放硬降音效
    playSound('harddrop');
    
    updateScore();
    freeze();
    dropCounter = 0;
}

// 检查并消除完整的行
function checkLines() {
    let linesCleared = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        // 检查当前行是否满
        const isLineFull = board[y].every(value => value > 0);
        
        if (isLineFull) {
            // 移除完成的行
            board.splice(y, 1);
            // 在顶部添加新行
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            
            // 重新检查当前行（因为上面的行下降了）
            y++;
        }
    }
    
    if (linesCleared > 0) {
        // 播放消除行音效
        playSound('clear');
        
        // 更新连击
        combo += linesCleared;
        
        // 计算得分
        // 1行=100分，2行=300分，3行=500分，4行=800分
        const lineScores = [0, 100, 300, 500, 800];
        let lineScore = lineScores[linesCleared] * level;
        
        // 连击加分
        if (combo > 1) {
            lineScore += combo * 50; // 每次连击额外加50分
        }
        
        score += lineScore;
        
        // 更新消除行计数
        lines += linesCleared;
        
        // 更新级别
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            // 级别提升
            level = newLevel;
            playSound('levelup');
            
            // 更新下落速度，随级别提升变快
            dropInterval = Math.max(1000 - (level - 1) * 100, 100); // 最快100ms
        } else {
            level = newLevel;
        }
        
        updateScore();
    } else {
        // 没有消除行，重置连击
        combo = 0;
        updateScore();
    }
}

// 简单的音效系统
function playSound(type) {
    // 实际项目中可以添加真正的音效
    // 这里为了简化，我们只记录音效类型，不实际播放
    console.log(`播放音效: ${type}`);
    
    // 如果要实现真实的音效，可以使用下面的代码
    /*
    const audio = new Audio(`sounds/${type}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(e => console.log('音效播放失败', e));
    */
}

// 处理设备方向变化
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        // 保存当前游戏状态
        const wasRunning = !paused && !gameOver && piece !== null;
        if (wasRunning) {
            togglePause(); // 暂停游戏
        }
        
        // 重设画布
        ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置缩放
        setCanvasSize();
        
        // 重新渲染
        draw();
        
        // 如果游戏正在运行，继续游戏
        if (wasRunning) {
            setTimeout(() => {
                togglePause(); // 恢复游戏
            }, 500);
        }
    }, 300); // 等待设备完成方向变化
});

// 开始游戏循环
function gameLoop(time = 0) {
    if (gameOver) {
        return;
    }
    
    if (paused) {
        requestId = requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = time - lastTime;
    lastTime = time;
    
    // 自动下落
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        dropPiece();
    }
    
    draw();
    requestId = requestAnimationFrame(gameLoop);
}

// 开始游戏
function startGame() {
    if (!piece) {
        // 新游戏
        resetGame();
        generateNextPiece();
        gameLoop();
        playSound('start');
    } else if (gameOver) {
        // 重新开始
        resetGame();
        generateNextPiece();
        gameLoop();
        playSound('start');
    } else if (paused) {
        // 继续游戏
        paused = false;
        hideOverlay();
        playSound('resume');
    }
}

// 暂停游戏
function togglePause() {
    if (!gameOver && piece) {
        paused = !paused;
        
        if (paused) {
            showPaused();
            playSound('pause');
        } else {
            hideOverlay();
            playSound('resume');
        }
    }
}

// 键盘控制
document.addEventListener('keydown', e => {
    if (gameOver) {
        if (e.key === 'Enter') {
            startGame();
        }
        return;
    }
    
    if (paused) {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            togglePause();
        }
        return;
    }
    
    if (!piece) return;
    
    switch (e.key) {
        case 'ArrowLeft':
            movePiece(-1);
            break;
        case 'ArrowRight':
            movePiece(1);
            break;
        case 'ArrowDown':
            dropPiece();
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
        case ' ':
            hardDrop();
            break;
        case 'c':
        case 'C':
            holdPieceFunction();
            break;
        case 'Escape':
        case 'p':
        case 'P':
            togglePause();
            break;
    }
});

// 按钮事件监听器
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', () => {
    resetGame();
    generateNextPiece();
    gameLoop();
    playSound('start');
});

// 初始绘制游戏板
draw();
// 初始化保留方块显示
clearHoldDisplay(); 