const socket = require(`socket.io-client`)(`http://127.0.0.1:3000`, {
    transports: ['websocket']
});
const inquirer = require('inquirer');
const clear = require('clear');
const themedLog = require('./themedLog');
const {
    roomEventType: {
        roomDeleteData,
        roomSendData,
        roomSendError,
        roomSendMessage
    },
    systemEventType: {
        systemDeleteData,
        systemSendData,
        systemSendError,
        systemSendMessage
    },
    userEventType: {
        userRegister,
        userNotice,
        userChangeName,
        userLoudSpeaker,
        userUpdateLoudSpeakerSettings,
        userCreateRoom,
        usetGetRoomInvitation,
        userSendMessage,
        userJoinRoom,
        userLeaveRoom,
        userUpdateRoomPassword,
        userKickOutRoom,
        userBlowUpRoom,
        userSetRoomNotice,
        userSendRoomInvitation
    }
} = require('./lib');

let me = {
    name: null,
    loudSpeakerOn: true,
    currentRoom: null,
    lastEvent: null
};
let userMap = {};
let roomMap = {};
let writeFlag = true;
let prompt = null;

const prePrint = async () => {
    if (writeFlag) {
        writeFlag = false;
        await pringChoices();
    }
};

const pringChoices = async () => {
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

        const roomUsers = roomMap[me.currentRoom].users;
        if (roomUsers[0] === me.id) {
            choiceMap['방비밀번호설정변경'] = 'update_room_password';
            choiceMap['방폭파하기'] = 'blow_up_room';
            choiceMap['유저강퇴시키기'] = 'kick_out_room';
        }
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

    prompt = inquirer
        .prompt([
            {
                type: 'rawlist',
                name: 'behaviorChoice',
                message: '어떤 동작을 실행하시겠습니까?',
                choices: choices,
                pageSize: 10
            }
        ]);
    
    behaviorChoice = (await prompt).behaviorChoice;

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

    if (behaviorChoice === '메세지보내기') {
        optionalParam.room = me.currentRoom;
    } else if (behaviorChoice === '방에서나가기') {
        optionalParam.room = me.currentRoom;
        me.currentRoom = undefined;
    } else if (behaviorChoice === '방에들어가기') {
        if (Object.keys(roomMap).length > 0) {
            const room = (await inquirer
                .prompt([
                    {
                        type: 'rawlist',
                        name: 'selectedRoom',
                        message: `어떤 방에 입장하시겠습니까? ${me.currentRoom ? `현재 '${me.currentRoom}'` : ''}`,
                        choices: Object.keys(roomMap).map(key => `${roomMap[key].title}(${key}${roomMap[key].isLocked ? ', 잠김' : ', 안 잠김'})`)
                    }
                ])
            ).selectedRoom;

            optionalParam.room = room.split('(');
            optionalParam.room = optionalParam.room.split(',')[0];            

            if (roomMap[optionalParam.room].isLocked) {
                optionalParam.password = (await inquirer
                    .prompt([
                        {
                            type: 'password',
                            name: 'password',
                            message: `방 비밀번호를 입력하세요`
                        }
                    ])
                ).password;
            }
        } else {
            themedLog.systemError(`[ SYSTEM ] 들어갈 방이 없습니다!`);
            writeFlag = true;
            return prePrint();
        }
    } else if (behaviorChoice === '방만들기') {
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

            optionalParam.password = (await inquirer
                .prompt([
                    {
                        type: 'password',
                        name: 'password',
                        message: `방에 비밀번호를 설정하시겠어요?(없으면 Enter)`
                    }
                ])
            ).password;
        } else {
            themedLog.systemError(`[ SYSTEM ] 초대할 유저가 없습니다!`);
            writeFlag = true;
            return prePrint();
        }
    } else if (behaviorChoice === '방비밀번호설정변경') {
        password = (await inquirer
            .prompt([
                {
                    type: 'password',
                    name: 'password',
                    message: `방에 비밀번호를 설정하시겠어요?(아니면 Enter)`
                }
            ])
        ).password;
    } else if (behaviorChoice === '방폭파하기') {
        optionalParam.room = me.currentRoom;
        me.currentRoom = undefined;
    } else if (behaviorChoice === '유저강퇴시키기') {
        const roomUsers = roomMap[me.currentRoom].users;
        if (roomUsers.length > 0 && (roomUsers.length === 1 && roomUsers[0] === me.id)) {
            behaviorArguments = (await inquirer
                .prompt([
                    {
                        type: 'checkbox',
                        name: 'behaviorArguments',
                        message: `어떤 유저를 방에 초대하시겠어요?`,
                        choices: roomUsers
                    }
                ])
            ).behaviorArguments;
        } else {
            themedLog.systemError(`[ SYSTEM ] 강퇴할 유저가 없습니다!`);
            writeFlag = true;
            return prePrint();
        }
    }

    writeFlag = true;

    me.lastEvent = choiceMap[behaviorChoice];

    socket.emit(choiceMap[behaviorChoice], {
        text: behaviorText,
        arguments: behaviorArguments,
        ...optionalParam
    });
};

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
        if (key === 'id') me.id = data.id; // register
        else if (key === 'name') me.name = data.name; // register, change_name
        else if (key === 'loudSpeakerOn') me.loudSpeakerOn = data.loudSpeakerOn; // update_loud_speaker_settings
        else if (key === 'userMap') { // register, change_name
            userMap = { ...userMap, ...data.userMap };
            const idx = Object.values(userMap).map(elem => elem.name).indexOf(me.name);
            delete userMap[Object.keys(userMap)[idx]];
        }
        else if (key === 'roomMap') roomMap = { ...roomMap, ...data.roomMap }; // register create_room
        else if (key === 'roomUsers') {
            const { room, users } = data.roomUsers
            roomMap[room].users = users; // disconnect, join_room, leave_room
        }
        else if (key === 'roomIsLocked') { 
            const { room, isLocked } = data.roomIsLocked
            roomMap[room].isLocked = isLocked; // update_room_password
        }
        else if (key === 'room') { // create_room, join_room
            me.currentRoom = data.room;
            prompt.ui.close();
            clear();
            writeFlag = true;
        }
    });
    if (me.name) await prePrint();
    // if (!c) await prePrint();
    // else sendMessage();
});

socket.on('admin_delete_data', async (data) => {
    if (data.user) delete userMap[data.user]; // disconnect
    if (data.room) delete userMap[data.room]; // disconnect, leave_room
    if (data.myRoom) me.currentRoom = undefined;

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
});

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
});

socket.on('blew_up_room', (data) => {
    socket.emit('blew_up_room', data);
});

socket.on('kick_out_room', (data) => {
    socket.emit('kicked_out_room', data);
});
