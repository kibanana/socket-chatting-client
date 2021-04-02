const socket = require(`socket.io-client`)(`http://127.0.0.1:3000`, {
    transports: [`websocket`]
});

socket.on('connect', () => {
    console.log('채팅 서버에 연결되었습니다!');
    socket.emit('register');
});

socket.on('disconnect', () => {
    console.log('채팅 서버와 연결이 끊겼습니다!');
});

socket.on('admin_message', (data) => {
    console.log(`[ SYSTEM ] ${data.message}`);
});

socket.on('notice', (data) => {
    console.log(`[ 공지 ] ${data.message}`);
});