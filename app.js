const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const { CONTROLS } = require('./constants');
const port = 3200;
const size = 15;

app.get('/', (req, res) => {
});

io.on('connection', (socket) => {
    socket.on('connect_failed', function () {
        document.write("Sorry, there seems to be an issue with the connection!");
    })

    socket.join('game');
    data.players[socket.id] = 'connected';
    console.log(socket.id + ' connected');

    socket.on('disconnect', () => {
        data.players[socket.id] = 'disconnected';
        console.log(socket.id + ' disconnected');
    });

    socket.on('getApples', () => {
        console.log('getting apples')
        socket.emit("getApples", data.apples);
    });

    socket.on('getSnakes', () => {
        socket.emit("getSnakes", { tails: getPlayersTails(), heads: getPlayersPositions(), controls: getPlayersControls() });
    });

    socket.on('join', () => {
        data.positions[socket.id] = { x: getRandomInt(0, size), y: getRandomInt(0, size) };
        data.controls[socket.id] = { processed: CONTROLS.Right, buffer: CONTROLS.Right };
        data.tails[socket.id] = [];

        data.players[socket.id] = 'joined';

        io.to('game').emit("join", { tails: { [socket.id]: data.tails[socket.id] }, heads: { [socket.id]: data.positions[socket.id] }, controls: { [socket.id]: data.controls[socket.id] } });
        console.log(socket.id + ' joined the table');
    });

    socket.on('controls', (control) => {
        if (data.players[socket.id] !== 'joined') {
            return;
        }

        let lastControl = data.controls[socket.id].processed;
        if (lastControl === control) {
            return;
        }
        if (lastControl === CONTROLS.Right && control === CONTROLS.Left
            || lastControl === CONTROLS.Left && control === CONTROLS.Right
            || lastControl === CONTROLS.Top && control === CONTROLS.Bottom
            || lastControl === CONTROLS.Bottom && control === CONTROLS.Top) {
            return;
        }

        data.controls[socket.id].buffer = control;
    });
});

var data = {
    apples: [],
    players: {},
    controls: {},
    positions: {},
    tails: {},
    grows: {}
}

counter = [];

emitTick = () => {
    io.emit("tick", {
        controls: getPlayersControls(),
        grows: getPlayersGrowths(),
    });
    data.grows = {};
}

startTimer = () => {
    let lastAppleTimestamp = new Date().getTime();
    setInterval(() => {
        let currentTimeStamp = new Date().getTime();
        moveAll();

        if (data.apples.length === 0 || lastAppleTimestamp + 1000 * 5 < currentTimeStamp) {
            addApple();
            lastAppleTimestamp = currentTimeStamp;
        }

        emitTick();
    }, 1000 / 5);
}


addApple = () => {
    let apple = {};
    while (true) {
        let x = getRandomInt(0, size);
        let y = getRandomInt(0, size);

        if (Object.values(data.positions).filter(pos => pos.x !== x && pos.y !== y).length === 0) {
            apple = { x, y };
            break;
        }
    }

    data.apples.push(apple);
    io.emit("addApple", apple);
}

removeApple = (apple) => {
    data.apples.splice(data.apples.findIndex(a => a.x === apple.x && a.y === apple.y), 1);

    io.emit("removeApple", apple);
}

moveAll = () => {
    Object.keys(getPlayersPositions()).forEach(playerId => {
        let posRef = data.positions[playerId];
        let newPos = { x: posRef.x, y: posRef.y };

        data.controls[playerId].processed = data.controls[playerId].buffer;
        switch (data.controls[playerId].processed) {
            case CONTROLS.Top:
                newPos.y = posRef.y - 1 < 0 ? size - 1 : posRef.y - 1;
                break;
            case CONTROLS.Bottom:
                newPos.y = posRef.y + 1 > size - 1 ? 0 : posRef.y + 1;
                break;
            case CONTROLS.Left:
                newPos.x = posRef.x - 1 < 0 ? size - 1 : posRef.x - 1;
                break;
            case CONTROLS.Right:
                newPos.x = posRef.x + 1 > size - 1 ? 0 : posRef.x + 1;
                break;
        }

        data.tails[playerId].push(data.positions[playerId]);
        console.log('tailLength', data.tails[playerId].length)
        if (Object.values(data.apples).filter(pos => pos.x === newPos.x && pos.y === newPos.y).length !== 0) {
            removeApple(newPos);
            data.grows[playerId] = 1;
        } else {
            data.tails[playerId].shift();
        }
        data.positions[playerId] = newPos;
    });
}

getPlayersControls = () => {
    return Object.fromEntries(Object
        .entries(data.controls)
        .filter(([key]) => data.players[key] == 'joined'));
}

getPlayersTails = () => {
    return Object.fromEntries(Object
        .entries(data.tails)
        .filter(([key]) => data.players[key] == 'joined'));
}

getPlayersPositions = () => {
    return Object.fromEntries(Object
        .entries(data.positions)
        .filter(([key]) => data.players[key] == 'joined'));
}

getPlayersGrowths = () => {
    return Object.fromEntries(Object
        .entries(data.grows)
        .filter(([key]) => data.players[key] == 'joined'));
}

getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

server.listen(port, () => {
    console.log('listening on *:' + port);
    startTimer();
});