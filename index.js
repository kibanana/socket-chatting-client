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
        systemNotify,
        systemSendData,
        systemSendError,
        systemSendMessage
    },
    userEventType: {
        userRegister,
        userLoudSpeaker,
        userSendMessage,
        userKickOutRoom,
        userBlowUpRoom,

        // choices
        userChangeName,
        userUpdateLoudSpeakerSettings,
        userCreateRoom,
        usetGetRoomInvitation,
        userJoinRoom,
        userLeaveRoom,
        userUpdateRoomPassword,
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
        const roomTitle = roomMap[me.currentRoom].title;
        const roomOwnerName = roomUsers[0] === me.id ? me.name : userMap[roomUsers[0]].name;
        themedLog.systemSuccess(`============= ${roomTitle}(${me.currentRoom}) ============= (${roomUsers.length}명, 방 주인: ${roomOwnerName})`);
    }

    const choices = [
        { text: '이름 변경', eventType: userChangeName },
        { text: '메세지 보내기', eventType: userSendMessage },
        { text: '방에서 나가기', eventType: userLeaveRoom },
        { text: '방 비밀번호 변경', eventType: userUpdateRoomPassword },
        { text: '방 폭파', eventType: userBlowUpRoom },
        { text: '유저 강퇴', eventType: userKickOutRoom },
        { text: '방에 들어가기', eventType: userJoinRoom },
        { text: '방 만들기', eventType: userCreateRoom },
        { text: '확성기', eventType: userLoudSpeaker },
        { text: '확성기 설정 변경', eventType: userUpdateLoudSpeakerSettings },
    ];

    const filteredChoices = [];
    filteredChoices.push(choices[0]);

    if (me.currentRoom) {
        filteredChoices.push(choices[1]);
        filteredChoices.push(choices[2]);

        const roomUsers = roomMap[me.currentRoom].users;
        if (roomUsers[0] === me.id) {
            filteredChoices.push(choices[3]);
            filteredChoices.push(choices[4]);
            filteredChoices.push(choices[5]);
        }
    } else {
        filteredChoices.push(choices[6]);
        filteredChoices.push(choices[7]);
    }

    filteredChoices.push(choices[8]);
    filteredChoices.push(choices[9]);
    
    const userChoices = filteredChoices.map(elem => elem.text);
    let behaviorChoice = undefined;
    let behaviorChoiceEventType = undefined;
    let behaviorText = undefined;
    let behaviorArguments = undefined;
    let optionalParam = {};

    prompt = inquirer
        .prompt([
            {
                type: 'rawlist',
                name: 'behaviorChoice',
                message: '===== 선택지 =====',
                choices: userChoices,
                pageSize: 10
            }
        ]);
    
    behaviorChoice = (await prompt).behaviorChoice;
    behaviorChoiceEventType = filteredChoices.filter(elem => elem.text === behaviorChoice)[0].eventType;

    if ([userChangeName, userSendMessage, userCreateRoom, userLoudSpeaker].includes(behaviorChoiceEventType)) {
        behaviorText = (await inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'behaviorText',
                    message: `'${behaviorChoice}' 상세정보를 입력해주세요`
                }
            ])
        ).behaviorText;
    }

    if (behaviorChoiceEventType === userSendMessage) {
        optionalParam.room = me.currentRoom;
    } else if (behaviorChoiceEventType === userLeaveRoom) {
        optionalParam.room = me.currentRoom;
        me.currentRoom = undefined;
    } else if (behaviorChoiceEventType === userJoinRoom) {
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
    } else if (behaviorChoiceEventType === userCreateRoom) {
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
    } else if (behaviorChoiceEventType === userUpdateRoomPassword) {
        password = (await inquirer
            .prompt([
                {
                    type: 'password',
                    name: 'password',
                    message: `방에 비밀번호를 설정하시겠어요? (아니면 Enter)`
                }
            ])
        ).password;
    } else if (behaviorChoiceEventType === userBlowUpRoom) {
        optionalParam.room = me.currentRoom;
        me.currentRoom = undefined;
    } else if (behaviorChoiceEventType === userKickOutRoom) {
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

    me.lastEvent = behaviorChoiceEventType;

    socket.emit(behaviorChoiceEventType, {
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

    me.lastEvent = userRegister;
    socket.emit(userRegister, { name });
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


// system

socket.on(systemNotify, (data) => {
    themedLog.systemSuccess(`[ 공지 ] ${data.message}`);
});

socket.on(systemSendMessage, async (data) => {
    themedLog.systemSuccess(`[ SYSTEM ] ${data.message}`);
});

socket.on(systemSendData, async (data) => {
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

socket.on(systemDeleteData, async (data) => {
    if (data.user) delete userMap[data.user]; // disconnect
    if (data.room) delete userMap[data.room]; // disconnect, leave_room
    if (data.myRoom) me.currentRoom = undefined;

    await prePrint();
});

socket.on(systemSendError, async (data) => {
    themedLog.systemError(`[ SYSTEM ] ${data.message}`);
    await prePrint();
});

// room
socket.on(roomSendMessage, async (data) => {
    themedLog.systemSuccess(`[ ROOM ] ${data.message}`);
});

socket.on(roomSendData, async (data) => {
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

socket.on(roomDeleteData, async (data) => {
    if (data.user) delete userMap[data.user]; // disconnect
    if (data.room) delete userMap[data.room]; // disconnect, leave_room
    if (data.myRoom) me.currentRoom = undefined;

    await prePrint();
});

socket.on(roomSendError, async (data) => {
    themedLog.systemError(`[ SYSTEM ] ${data.message}`);
    await prePrint();
});

socket.on(userLoudSpeaker, async (data) => {
    themedLog.other(data.user, `${data.message} [확성기]`);

    if (me.lastEvent === userLoudSpeaker) {
        await prePrint();
    }
});

socket.on(userSendMessage, async (data) => {
    if (me.name === data.user) themedLog.me(data.message);
    else themedLog.other(data.user, data.message);

    if (me.lastEvent === userSendMessage) {
        await prePrint();
    }
    // if (me.lastEvent === userSendMessage && !me.currentRoom) {
    //     await prePrint();
    // }
    // else sendMessage();
});

socket.on(userBlowUpRoom, (data) => {
    socket.emit(userBlowUpRoom, data);
});

socket.on(userKickOutRoom, (data) => {
    socket.emit(userKickOutRoom, data);
});
