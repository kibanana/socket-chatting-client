const socket = require(`socket.io-client`)(`http://127.0.0.1:3000`, {
    transports: [`websocket`]
});
const inquirer = require('inquirer');
const themedLog = require('./themedLog');

let me = { name: undefined, loudSpeakerOn: true, room: [] };
let userMap = {};
let writeLogFlag = true;

const meLog = () => {
    console.log(`[ ${me.name} ] - 확성기 ${me.loudSpeakerOn ? 'O' : 'X'}, ${me.room.length > 0 ? `${me.room.length}개` : '방 없음'}`);
};

const choiceLog = async () => {
    const choiceMap = {
        '이름변경': 'change_name',
        '확성기': 'global_message',
        '확성기설정변경': 'update_global_message_settings',
        '방만들기': 'create_room',
    };
    
    if (me.room.length > 0) {
        choiceMap['메세지보내기'] = 'send_message';
    }

    const choices = Object.keys(choiceMap);
    let behaviorChoice = undefined;
    let behaviorText = undefined;
    let behaviorArguments = undefined;
    let result = undefined;

    behaviorChoice = (await inquirer
        .prompt([
            {
                type: 'rawlist',
                name: 'behaviorChoice',
                message: '어떤 동작을 실행하시겠습니까?',
                choices: choices,
                pageSize: 10
            }
        ])
    ).behaviorChoice;
    
    if (choices[0] === behaviorChoice || choices[1] === behaviorChoice || choices[3] === behaviorChoice) {
        behaviorText = (await inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'behaviorText',
                    message: `'${behaviorChoice}' 동작 상세정보를 입력해주세요`
                }
            ])
        ).behaviorText;
    }

    if (choices.length > 3 && choices[3] === behaviorChoice && Object.keys(userMap).length > 0) {
        const userKeys = Object.keys(userMap);
        const userValues = Object.values(userMap).map(elem => elem.name);

        behaviorArguments = (await inquirer
            .prompt([
                {
                    type: 'checkbox',
                    name: 'behaviorArguments',
                    message: `어떤 유저를 방에 초대하시겠어요?`,
                    choices: userValues
                }
            ])
        ).behaviorArguments;

        for (let i = 0; i < behaviorArguments.length; i++) {
            behaviorArguments[i] = userKeys[userValues.indexOf(behaviorArguments[i])];
        }
    }

    writeLogFlag = true;

    socket.emit(choiceMap[behaviorChoice], { text: behaviorText, arguments: behaviorArguments });
};

socket.on('connect', () => {
    themedLog.systemSuccess('[ SYSTEM ] 채팅 서버에 연결되었습니다!');
    socket.emit('register');
});

socket.on('connect_error', (error) => {
    themedLog.systemError('[ SYSTEM ] 채팅 서버에 연결하는 도중 오류가 발생했습니다!');
});

socket.on('connect_error', () => {
    themedLog.systemError('[ SYSTEM ] 채팅 서버에 연결하는 도중 오류(timeout)가 발생했습니다!');
});

socket.on('disconnect', () => {
    themedLog.systemError('[ SYSTEM ] 채팅 서버와 연결이 끊겼습니다!');
});

socket.on('error', (error) => {
    themedLog.systemError('[ SYSTEM ] 오류가 발생했습니다!');
});

socket.on('reconnect', (attemptNumber) => {
    themedLog.systemSuccess(`[ SYSTEM ] ...재연결중(${attemptNumber})...`);
});

socket.on('reconnect_failed', () => {
    themedLog.systemError('[ SYSTEM ] 채팅 서버 재연결에 실패했습니다!');
});


socket.on('admin_message', async (data) => {
    themedLog.systemSuccess(`[ SYSTEM ] ${data.message}`);

    if (data.name) {
        me.name = data.name;
    }
    if (data.hasOwnProperty('loudSpeakerOn')) {
        me.loudSpeakerOn = data.loudSpeakerOn;
    }
    if (data.room) {
        me.room.push(data.room);
    }
    if (data.userMap) {
        userMap = { ...userMap, ...data.userMap };
        const idx = Object.values(userMap).map(elem => elem.name).indexOf(me.name);
        delete userMap[Object.keys(userMap)[idx]];
    }

    if (writeLogFlag) {
        writeLogFlag = false;
        meLog();
        await choiceLog();
    }
});

socket.on('admin_data', async (data) => {
    if (data.name) {
        me.name = data.name;
    }
    if (data.userMap) {
        userMap = { ...userMap, ...data.userMap };
        const idx = Object.values(userMap).map(elem => elem.name).indexOf(me.name);
        delete userMap[Object.keys(userMap)[idx]];
    }
    
    if (writeLogFlag) {
        writeLogFlag = false;
        meLog();
        await choiceLog();
    }
});

socket.on('admin_delete_data', async (data) => {
    if (data.user) {
        delete userMap[data.user];
    }

    if (writeLogFlag) {
        writeLogFlag = false;
        meLog();
        await choiceLog();
    }
});

socket.on('admin_error', async (data) => {
    themedLog.systemError(`[ SYSTEM ] ${data.message}`);

    if (writeLogFlag) {
        writeLogFlag = false;
        meLog();
        await choiceLog();
    }
});

socket.on('notice', (data) => {
    themedLog.systemSuccess(`[ 공지 ] ${data.message}`);
});


socket.on('global_message', (data) => {
    themedLog.other(data.user, data.message);
})