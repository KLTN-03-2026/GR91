import assert from "node:assert/strict";
import { analyzeInput } from "../src/services/chatbot/nlu.js";
import { updateContext } from "../src/services/chatbot/context.js";

function expectNlu(text, expected) {
  const result = analyzeInput(text);
  for (const [path, value] of Object.entries(expected)) {
    const actual = path.split(".").reduce((acc, key) => acc?.[key], result);
    assert.deepEqual(actual, value, `${text}: expected ${path}=${value}, got ${actual}`);
  }
  return result;
}

async function expectContext(text, initialContext, expected) {
  const nlu = analyzeInput(text);
  const context = await updateContext(initialContext, nlu);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(context[key], value, `${text}: expected context.${key}=${value}, got ${context[key]}`);
  }
  return context;
}

expectNlu("tìm phòng cho 2 người dưới 1 triệu", {
  "intent": "search",
  "entities.people": 2,
  "entities.max_price": 1_000_000,
});

expectNlu("phòng có bồn tắm nằm", {
  "entities.amenities": ["bathtub"],
});

await expectContext("loại khác giá 500", { room_type: "Family", room_type_id: 3, max_price: 1_200_000 }, {
  room_type: null,
  room_type_id: null,
  max_price: 500_000,
});

await expectContext("giá cao hơn nữa", { max_price: 500_000 }, {
  min_price: 500_000,
  max_price: null,
  sort_by: "price_asc",
});

await expectContext("rẻ hơn", { min_price: 1_200_000 }, {
  min_price: null,
  max_price: 1_200_000,
  sort_by: "price_desc",
});

console.log("Chatbot eval passed");
