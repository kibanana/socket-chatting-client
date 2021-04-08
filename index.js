const socket = require(`socket.io-client`)(`http://127.0.0.1:3000`, {
    transports: [`websocket`]
});
const clear = require('clear');
const inquirer = require('inquirer');
const themedLog = require('./themedLog');

let me = { name: undefined, loudSpeakerOn: true, currentRoom: undefined, lastEvent: undefined };
let userMap = {};
let roomMap = {};
let writeLogFlag = true;

const choiceLog = async () => {
    themedLog.systemSuccess(`[ ${me.name} ] - 확성기 ${me.loudSpeakerOn ? 'O' : 'X'}`);
    if (me.currentRoom) {
        const roomUsers = roomMap[me.currentRoom].users;
        themedLog.systemSuccess(`============= ${roomMap[me.currentRoom].title}(${me.currentRoom}) ============= (${roomUsers.length}명, 방 주인: ${roomUsers[0] === me.id ? me.name : userMap[roomUsers[0]].name})`);
    }

    const choiceMap = {};
    choiceMap['이름변경'] = 'change_name';

    if (me.currentRoom) {
        choiceMap['메세지보내기'] = 'send_message';
        choiceMap['방에서나가기'] = 'leave_room';
    } else {
        choiceMap['방에들어가기'] = 'join_room';
        choiceMap['방만들기'] = 'create_room';
    }

    choiceMap['확성기'] = 'loud_speaker';
    choiceMap['확성기설정변경'] = 'update_loud_speaker_settings';
    
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

    if (['이름변경', '메세지보내기', '방만들기', '확성기'].includes(behaviorChoice)) {
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

    if ('메세지보내기' === behaviorChoice) {
        optionalParam.room = me.currentRoom;
    } else if ('방에서나가기' === behaviorChoice) {
        optionalParam.room = me.currentRoom;
        me.currentRoom = undefined;
    } else if ('방에들어가기' === behaviorChoice) {
        if (Object.keys(roomMap).length > 0) {
            const room = (await inquirer
                .prompt([
                    {
                        type: 'rawlist',
                        name: 'selectedRoom',
                        message: `어떤 방에 입장하시겠습니까? ${me.currentRoom ? `현재 '${me.currentRoom}'` : ''}`,
                        choices: Object.keys(roomMap).map(key => `${roomMap[key].title}~${key}`)
                    }
                ])
            ).selectedRoom;

            optionalParam.room = room.split('~')[1];
        } else {
            themedLog.systemError(`[ SYSTEM ] 들어갈 방이 없습니다!`);
            writeLogFlag = true;
            return prePrint();
        }
    } else if ('방만들기' === behaviorChoice) {
        const userKeys = Object.keys(userMap);
        if (userKeys.length > 0) {
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
        } else {
            themedLog.systemError(`[ SYSTEM ] 초대할 유저가 없습니다!`);
            writeLogFlag = true;
            return prePrint();
        }
    }

    writeLogFlag = true;

    me.lastEvent = choiceMap[behaviorChoice];

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
};

// const sendMessage = async () => {
//     clear();

//     process.stdout.write('\x1Bc')
     
//     const myRL = require('serverline')
     
//     myRL.init()
    
//     myRL.setCompletion(['help', 'command1', 'command2', 'login', 'check', 'ping'])
//     myRL.setPrompt('> ')
    
//     myRL.on('line', function(line) {
//     console.log('cmd:', line)
//     switch (line) {
//         case 'help':
//         console.log('help: To get this message.')
//         break
//         case 'pwd':
//         console.log('toggle muted', !myRL.isMuted())
//         myRL.setMuted(!myRL.isMuted(), '> [hidden]')
//         return true
//         case 'secret':
//         return myRL.secret('secret:', function() {
//             console.log(';)')
//         })
//     }
    
//     if (myRL.isMuted())
//         myRL.setMuted(false)
//     })
    
//     myRL.on('SIGINT', function(rl) {
//     rl.question('Confirm exit: ', (answer) => answer.match(/^y(es)?$/i) ? process.exit(0) : rl.output.write('\x1B[1K> '))
//     })
// };

socket.on('connect', async () => {
    themedLog.systemSuccess('[ SYSTEM ] 채팅 서버에 연결되었습니다!');

    const { name } = await inquirer
        .prompt([
            {
                type: 'input',
                name: 'name',
                message: '이전 계정명이나 사용하고 싶은 계정명을 입력해주세요!',
            }
        ]);

    me.lastEvent = 'register';
    socket.emit('register', { name });
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
    themedLog.systemSuccess(`[ SYSTEM ] ${data.message}`);
});

socket.on('admin_data', async (data) => {
    Object.keys(data).forEach(key => {
        if (key === 'id') me.id = data.id; // reguster
        if (key === 'name') me.name = data.name; // register, change_name
        if (key === 'loudSpeakerOn') me.loudSpeakerOn = data.loudSpeakerOn; // update_loud_speaker_settings
        if (key === 'userMap') { // register, change_name
            userMap = { ...userMap, ...data.userMap };
            const idx = Object.values(userMap).map(elem => elem.name).indexOf(me.name);
            delete userMap[Object.keys(userMap)[idx]];
        }
        if (key === 'roomMap') roomMap = { ...roomMap, ...data.roomMap }; // register create_room
        if (key === 'roomUsers') {
            const { room, users } = data.roomUsers
            roomMap[room].users = users; // disconnect, join_room, leave_room
        }
        if (key === 'room') { // create_room, join_room
            me.currentRoom = data.room;
            clear();
            writeLogFlag = true;
        }
    });
    if (me.name) await prePrint();
    // if (!me.currentRoom) await prePrint();
    // else sendMessage();
});

socket.on('admin_delete_data', async (data) => {
    if (data.user) delete userMap[data.user]; // disconnect
    if (data.room) delete userMap[data.room]; // disconnect, leave_room
    await prePrint();
});

socket.on('admin_error', async (data) => {
    themedLog.systemError(`[ SYSTEM ] ${data.message}`);
    await prePrint();
});

socket.on('notice', (data) => {
    themedLog.systemSuccess(`[ 공지 ] ${data.message}`);
});


socket.on('loud_speaker', async (data) => {
    themedLog.other(data.user, `${data.message} [확성기]`);

    if (me.lastEvent === 'loud_speaker') {
        await prePrint();
    }
})

socket.on('send_message', async (data) => {
    if (me.name === data.user) themedLog.me(data.message);
    else themedLog.other(data.user, data.message);

    if (me.lastEvent === 'send_message') {
        await prePrint();
    }
    // if (me.lastEvent === 'send_message' && !me.currentRoom) {
    //     await prePrint();
    // }
    // else sendMessage();
})