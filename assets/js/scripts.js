var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var multiplayer = document.getElementById('multiplayer');
var multiplayerLink = document.getElementById('multiplayer-link');
var resultElement = document.getElementById('result');
var resultText = document.getElementById('result-text');
var restart = document.getElementById('restart');
var bg = new Image();
var coin1 = new Image();
var coin2 = new Image();

var width = 7;
var height = 6;
var padding = 50;
var cursorCoinI = null;

var grid = new Array(width);
var coins = [];

for (let x = 0; x < width; x++) {
    grid[x] = new Array(height).fill(null);
}

coin1.src = 'assets/img/coin1.png';
coin2.src = 'assets/img/coin2.png';
bg.src = 'assets/img/bg.png';
window.addEventListener('resize', resize);
canvas.addEventListener('mousemove', cursorMove);
canvas.addEventListener('touchmove', cursorMove);
canvas.addEventListener('click', userCoinDrop);
resize();
render();

restart.addEventListener('click', function() {
    restartGame();
    socket.emit('msg', { type: 'restart' });
});

setInterval(function () {
    const { boardFill, offsetX, offsetY, w, h } = renderMeta();
    for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        const targetHeight = offsetY / 2 + coin.y * h;
        coin.v += 1;
        coin.pos += coin.v;
        if (coin.pos > targetHeight) {
            coin.v = 0;
            coin.pos = targetHeight;
        }
    }
}, 1000 / 40);

const queryRoom = decodeQuery(window.location.href)['room'];
const rootPlayer = !queryRoom;
var myTurn = rootPlayer;
var waiting = !!rootPlayer;
const room = queryRoom || Math.random().toString(36);
let connected = false;
const playerId = rootPlayer ? room : Math.random().toString(36);
var otherPlayerId = rootPlayer ? null : room;


const socket = io(`https://ess-server.herokuapp.com/api/4inarow/no-persist-open-chat`);
socket.on('connect', () => {
    console.log('connected');
    socket.emit('init', { room: room, nickname: playerId }, () => {
        connected = true;
        socket.emit('msg', { type: 'join', playerId });
        console.log('init done', 'otherplayerid', otherPlayerId);
        if (rootPlayer) {
            multiplayer.style.display = 'block';
            multiplayerLink.innerText = location.origin + location.pathname + '?room=' + room;
        }
    });
});

socket.on('msg', data => {
    if (data.type === 'join') {
        otherPlayerId = data.playerId;
        console.log('otherplayerid', otherPlayerId);
        multiplayer.style.display = '';
        waiting = false;
    }
    else if (data.type === 'coindrop') {
        coinDrop(data.cursorCoinI, otherPlayerId);
        myTurn = true;
    }
    else if (data.type === 'restart') {
        restartGame();
    }
    console.log(data);
});

socket.on('disconnect', () => {
    connected = false;
    console.log('disconnected');
});

function decodeQuery(url) {
    url = url.split('?').slice(-1)[0].split('#')[0];
    var ret = {}, qKVP, qParts = url.split('&');
    for (var i = 0; i < qParts.length; i++) {
        qKVP = qParts[i].split('=');
        ret[decodeURIComponent(qKVP[0])] = decodeURIComponent(qKVP[1]);
    }
    return ret;
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function cursorMove(e) {
    if (!myTurn || waiting) return cursorCoinI = null;
    const { boardFill, offsetX, offsetY, w, h } = renderMeta();
    const cx = e.clientX;
    const cy = e.clientY;
    const x = Math.floor((cx - offsetX / 2) / w);
    const y = Math.floor((cy - offsetY / 2) / h);
    if (x < 0 || x >= width || y < -1 || y > 0) {
        cursorCoinI = null;
    } else {
        cursorCoinI = x;
    }
}

function restartGame() {
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            grid[x][y] = null;
        }
    }
    coins.splice(0, coins.length);
    waiting = false;
    resultElement.style.display = 'none';
}

function userCoinDrop() {
    if (!myTurn || waiting) return;
    if (cursorCoinI === null) return;
    if (playerId === undefined) throw 'Player id is undefined';
    coinDrop(cursorCoinI, playerId);
    myTurn = false;
    socket.emit('msg', { type: 'coindrop', cursorCoinI });
}

function coinDrop(cursorCoinI, pId) {
    if (pId === undefined) throw 'Player id is undefined';
    if (grid[cursorCoinI][0] !== null) return; // column is full
    for (var y = 0; y < height; y++) if (grid[cursorCoinI][y + 1] !== null) break;
    const { boardFill, offsetX, offsetY, w, h } = renderMeta();
    const coin = grid[cursorCoinI][y] = {
        x: cursorCoinI,
        y,
        pos: coinDropHeight(offsetY, h),
        v: 0,
        playerId: pId
    };
    coins.push(coin);
    const winner = testWinner();
    if (winner) {
        waiting= true;
        resultElement.style.display = 'block';
        resultText.innerText = winner === playerId ? 'You won' : 'You lost';
    }
}

function renderMeta() {
    const boardFill = fill(width, height, canvas.width, canvas.height);
    boardFill.width -= padding * 2;
    boardFill.height -= padding * 2;
    const offsetX = canvas.width - boardFill.width;
    const offsetY = canvas.height - boardFill.height;
    const w = boardFill.width / width;
    const h = boardFill.height / height;
    return { boardFill, offsetX, offsetY, w, h };
}

function coinDropHeight(offsetY, h) {
    return offsetY / 2 - h - 5
}

function render() {
    const bgFit = fit(bg.width, bg.height, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0, bgFit.width, bgFit.height);
    ctx.strokeStyle = '#c8d9e1';
    const { boardFill, offsetX, offsetY, w, h } = renderMeta();

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            ctx.strokeRect(offsetX / 2 + x * w, offsetY / 2 + y * h, w, h);
        }
    }
    for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        ctx.drawImage(coin.playerId === playerId ? coin1 : coin2, offsetX / 2 + coin.x * w, coin.pos, w, h);
    }
    if (cursorCoinI !== null) {
        ctx.drawImage(coin1, offsetX / 2 + cursorCoinI * w, coinDropHeight(offsetY, h), w, h);
    }

    requestAnimationFrame(render);
}

function testWinner() {
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const p = testRow(x, y);
            if (p) return p;
        }
    }
}

function testRow(x, y) {
    const row = [grid[x][y], (grid[x + 1] || {})[y], (grid[x + 2] || {})[y], (grid[x + 3] || {})[y]];
    if (row.every(x => x)) {
        const pId = grid[x][y].playerId;
        if (row.every(x => x.playerId === pId)) return pId;
    }
    const row2 = [grid[x][y], grid[x][y + 1], grid[x][y + 2], grid[x][y + 3]];
    if (row2.every(x => x)) {
        const pId2 = grid[x][y].playerId;
        if (row2.every(x => x.playerId === pId2)) return pId2;
    };
    return null;
}

function contain(width, height, maxWidth, maxHeight) {
    if (width > maxWidth) {
        const ratio = maxWidth / width;
        width *= ratio;
        height *= ratio;
    }
    if (height > maxHeight) {
        const ratio = maxHeight / height;
        height *= ratio;
        width *= ratio;
    }
    return { width, height };
}

function cover(width, height, minWidth, minHeight) {
    if (width < minWidth) {
        const ratio = minWidth / width;
        width *= ratio;
        height *= ratio;
    }
    if (height < minHeight) {
        const ratio = minHeight / height;
        height *= ratio;
        width *= ratio;
    }
    return { width, height };
}

function fit(width, height, tgtWidth, tgtHeight) {
    const c = contain(width, height, tgtWidth, tgtHeight);
    return cover(c.width, c.height, tgtWidth, tgtHeight);
}

function fill(width, height, tgtWidth, tgtHeight) {
    const c = cover(width, height, tgtWidth, tgtHeight);
    return contain(c.width, c.height, tgtWidth, tgtHeight);
}




