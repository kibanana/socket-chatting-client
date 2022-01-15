const socket = require(`socket.io-client`)(`http://127.0.0.1:3000`, {
    transports: ['websocket']
});
const inquirer = require('inquirer');
const clear = require('clear');
const logGenerator = require('./modules/logGenerator');
const themedLog = require('./modules/themedLog');
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

// 뭉뚱그렸던 systemSendData 등의 이벤트 분리하기
// notice / system / room / user -> 색 다 다른거 쓰게 바꾸기
// 요청 보내고 5초가 지나도 뭐가 안오면 에러로 처리하기

const prePrint = async () => {
    try {
        if (writeFlag) {
            writeFlag = false;
            await printChoices();
        }
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
};

const printChoices = async () => {
    try {
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
        const userAction = {
            choice: null,
            choiceEventType: null,
            text: null,
            args: null,
            optionalArgs: null
        }
    
        prompt = inquirer
            .prompt([
                {
                    type: 'rawlist',
                    name: 'actionChoice',
                    message: '===== 선택지 =====',
                    choices: userChoices,
                    pageSize: 10
                }
            ]);
        
        userAction.choice = (await prompt).actionChoice;
        userAction.choiceEventType = filteredChoices.filter(elem => elem.text === userAction.choice)[0].eventType;
    
        if ([userChangeName, userSendMessage, userCreateRoom, userLoudSpeaker].includes(userAction.choiceEventType)) {
            userAction.text = (
                await inquirer
                    .prompt([
                        {
                            type: 'input',
                            name: 'actionText',
                            message: `'${userAction.choice}' 상세정보를 입력해주세요`
                        }
                    ])
            ).actionText;
        }
    
        if (userAction.choiceEventType === userSendMessage) {
            userAction.optionalArgs.room = me.currentRoom;
        } else if (userAction.choiceEventType === userLeaveRoom) {
            userAction.optionalArgs.room = me.currentRoom;
            me.currentRoom = null;
        } else if (userAction.choiceEventType === userJoinRoom) {
            if (Object.keys(roomMap).length > 0) {
                const room = (
                    await inquirer
                        .prompt([
                            {
                                type: 'rawlist',
                                name: 'selectedRoom',
                                message: `어떤 방에 입장하시겠습니까? ${me.currentRoom ? `현재 '${me.currentRoom}'` : ''}`,
                                choices: Object.keys(roomMap).map(key => `${roomMap[key].title}(${key}${roomMap[key].isLocked ? ', 잠김' : ', 안 잠김'})`)
                            }
                        ])
                ).selectedRoom;
    
                // TODO
                userAction.optionalArgs.room = room.split('(').split(',')[0];
    
                if (roomMap[userAction.optionalArgs.room].isLocked) {
                    userAction.optionalArgs.password = (await inquirer
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
                themedLog.systemError(logGenerator.system(`들어갈 방이 없습니다!`));
                writeFlag = true;
                return prePrint();
            }
        } else if (userAction.choiceEventType === userCreateRoom) {
            const userKeys = Object.keys(userMap);
            if (userKeys.length > 0) {
                const userNames = Object.values(userMap).map(elem => elem.name);
                
                userAction.args = (
                    await inquirer
                        .prompt([
                            {
                                type: 'checkbox',
                                name: 'actionArgs',
                                message: `어떤 유저를 방에 초대하시겠어요?`,
                                choices: userNames
                            }
                        ])
                ).actionArgs;
        
                for (let i = 0; i < userAction.args.length; i++) {
                    userAction.args[i] = userKeys[userNames.indexOf(userAction.args[i])];
                }
    
                userAction.optionalArgs.password = (
                    await inquirer
                        .prompt([
                            {
                                type: 'password',
                                name: 'password',
                                message: `방에 비밀번호를 설정하시겠어요? (없으면 Enter)`
                            }
                        ])
                ).password;
            } else {
                themedLog.systemError(logGenerator.system(`초대할 유저가 없습니다!`));
    
                writeFlag = true;
    
                return prePrint();
            }
        } else if (userAction.choiceEventType === userUpdateRoomPassword) {
            password = (
                await inquirer
                    .prompt([
                        {
                            type: 'password',
                            name: 'password',
                            message: `방에 비밀번호를 설정하시겠어요? (아니면 Enter)`
                        }
                    ])
            ).password;
        } else if (userAction.choiceEventType === userBlowUpRoom) {
            userAction.optionalArgs.room = me.currentRoom;
            me.currentRoom = null;
        } else if (userAction.choiceEventType === userKickOutRoom) {
            const roomUsers = roomMap[me.currentRoom].users;
            if (roomUsers.length > 0 && (roomUsers.length === 1 && roomUsers[0] === me.id)) {
                userAction.args = (
                    await inquirer
                        .prompt([
                            {
                                type: 'checkbox',
                                name: 'actionArgs',
                                message: `어떤 유저를 방에 초대하시겠어요?`,
                                choices: roomUsers
                            }
                        ])
                ).actionArgs;
            } else {
                themedLog.systemError(logGenerator.system(`강퇴할 유저가 없습니다!`));
    
                writeFlag = true;
                
                return prePrint();
            }
        }
    
        writeFlag = true;
        me.lastEvent = userAction.choiceEventType;
    
        socket.emit(userAction.choiceEventType, {
            text: userAction.text,
            arguments: userAction.args,
            ...userAction.optionalArgs
        });
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
};

socket.on('connect', async () => {
    try {
        themedLog.systemSuccess(logGenerator.system('채팅 서버에 연결되었습니다!'));

        const { name } = await inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: '이전 닉네임/사용하고 싶은 닉네임을 입력해주세요!',
                }
            ]);

        me.lastEvent = userRegister;
        socket.emit(userRegister, { name });
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on('connect_error', (error) => {
    themedLog.systemError(logGenerator.system('채팅 서버에 연결하는 도중 오류가 발생했습니다!'));
});

socket.on('connect_error', () => {
    themedLog.systemError(logGenerator.system('채팅 서버에 연결하는 도중 오류(timeout)가 발생했습니다!'));
});

socket.on('disconnect', () => {
    themedLog.systemError(logGenerator.system('채팅 서버와 연결이 끊겼습니다!'));
    process.exit(0);
});

socket.on('error', (error) => {
    themedLog.systemError(logGenerator.system('오류가 발생했습니다!'));
});

socket.on('reconnect', (attemptNumber) => {
    themedLog.systemSuccess(logGenerator.system(`...재연결중(${attemptNumber})...`));
});

socket.on('reconnect_failed', () => {
    themedLog.systemError(logGenerator.system('채팅 서버 재연결에 실패했습니다!'));
});


// system
socket.on(systemNotify, (data) => {
    themedLog.systemSuccess(logGenerator.notice(data.message));
});

socket.on(systemSendMessage, async (data) => {
    themedLog.systemSuccess(logGenerator.system(`${data.message}`));
});

socket.on(systemSendData, async (data) => {
    try {
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
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on(systemDeleteData, async (data) => {
    try {
        if (data.user) delete userMap[data.user]; // disconnect
        if (data.room) delete userMap[data.room]; // disconnect, userLeaveRoom, userBlowUpRoom
        if (data.isRoomMine) me.currentRoom = null; // userKickOutRoom, userBlowUpRoom

        await prePrint();
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on(systemSendError, async (data) => {
    try {
        themedLog.systemError(logGenerator.system(data.message));
        await prePrint();
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

// room
socket.on(roomSendMessage, async (data) => {
    themedLog.systemSuccess(logGenerator.room(data.message));
});

socket.on(roomSendData, async (data) => { // userCreateRoom, userLeaveRoom
    try {
        me.currentRoom = data.room;

        prompt.ui.close();
        clear();
        writeFlag = true;

        if (me.name) await prePrint();
        // if (!c) await prePrint();
        // else sendMessage();
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on(roomDeleteData, async (data) => {
    try {
        if (data.user) delete userMap[data.user]; // disconnect
        if (data.room) delete userMap[data.room]; // disconnect, leave_room
        if (data.isRoomMine) me.currentRoom = null;

        await prePrint();
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on(roomSendError, async (data) => {
    try {
        themedLog.systemError(logGenerator.system(data.message));
        await prePrint();
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

// user
socket.on(userLoudSpeaker, async (data) => {
    try {
        themedLog.other(data.user, logGenerator.loudSpaker(data.message));

        if (me.lastEvent === userLoudSpeaker) {
            await prePrint();
        }
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on(userSendMessage, async (data) => {
    try {
        if (me.name === data.user) themedLog.me(data.message);
        else themedLog.other(data.user, data.message);

        if (me.lastEvent === userSendMessage) {
            await prePrint();
        }
        // if (me.lastEvent === userSendMessage && !me.currentRoom) {
        //     await prePrint();
        // }
        // else sendMessage();
    } catch (err) {
        themedLog.systemError(logGenerator.systemDefaultError());
        setTimeout(async () => await prePrint(), 5000);
    }
});

socket.on(userBlowUpRoom, (data) => {
    socket.emit(userBlowUpRoom, data);
});

socket.on(userKickOutRoom, (data) => {
    socket.emit(userKickOutRoom, data);
});
