const { searchRooms } = require('./src/services/chatbot/room.service');
searchRooms({ guests: 4 }).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
