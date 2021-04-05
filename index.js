const socket = require(`socket.io-client`)(`http://127.0.0.1:3000`, {
    transports: [`websocket`]
});
const clear = require('clear');
const inquirer = require('inquirer');
const themedLog = require('./themedLog');

let me = { name: undefined, loudSpeakerOn: true, room: [] };
let userMap = {};
let writeLogFlag = true;

const choiceLog = async () => {
    console.log(`[ ${me.name} ] - 확성기 ${me.loudSpeakerOn ? 'O' : 'X'}, ${me.room.length > 0 ? `${me.room.length}개(${me.room.join(', ')})` : '방 없음'}`);

    const choiceMap = {};
    choiceMap['이름변경'] = 'change_name';
    choiceMap['방만들기'] = 'create_room';

    if (me.room.length > 0) choiceMap['메세지보내기'] = 'send_message';

    choiceMap['확성기'] = 'global_message';
    choiceMap['확성기설정변경'] = 'update_global_message_settings';
    
    const choices = Object.keys(choiceMap);
    let behaviorChoice = undefined;
    let behaviorText = undefined;
    let behaviorArguments = undefined;
    let optionalParam = {};

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
    
    if (['이름변경', '방만들기', '메세지보내기', '확성기'].includes(behaviorChoice)) {
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

    const userKeys = Object.keys(userMap);
    const userValues = Object.values(userMap).map(elem => elem.name);
    if ('방만들기' === behaviorChoice && userKeys.length > 0) {
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

    if ('메세지보내기' === behaviorChoice) {
        optionalParam.room = me.room[0];
    }

    writeLogFlag = true;

    socket.emit(choiceMap[behaviorChoice], {
        text: behaviorText,
        arguments: behaviorArguments,
        ...optionalParam
    });
};

const prePrint = async () => {
    if (writeLogFlag) {
        writeLogFlag = false;
        await choiceLog();
    }
}

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
    process.exit(0);
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
    if (data.name) {
        me.name = data.name;
    }
    if (data.hasOwnProperty('loudSpeakerOn')) {
        me.loudSpeakerOn = data.loudSpeakerOn;
    }
    if (data.room) {
        me.room.push(data.room);
        clear();
        writeLogFlag = true;
    }
    if (data.userMap) {
        userMap = { ...userMap, ...data.userMap };
        const idx = Object.values(userMap).map(elem => elem.name).indexOf(me.name);
        delete userMap[Object.keys(userMap)[idx]];
    }

    themedLog.systemSuccess(`[ SYSTEM ] ${data.message}`);

    await prePrint();
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

    await prePrint();
});

socket.on('admin_delete_data', async (data) => {
    if (data.user) {
        delete userMap[data.user];
    }

    await prePrint();
});

socket.on('admin_error', async (data) => {
    themedLog.systemError(`[ SYSTEM ] ${data.message}`);

    await prePrint();
});

socket.on('notice', (data) => {
    themedLog.systemSuccess(`[ 공지 ] ${data.message}`);
});


socket.on('global_message', async (data) => {
    themedLog.other(data.user, data.message);

    await prePrint(writeLogFlag);
})

socket.on('send_message', async (data) => {
    themedLog.other(data.user, data.message);

    await prePrint(writeLogFlag);
})