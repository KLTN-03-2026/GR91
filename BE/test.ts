import { searchRooms } from './src/services/chatbot/room.service';
(async () => {
  try {
    const res = await searchRooms({ guests: 4 });
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
