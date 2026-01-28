"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openLeavelDb = openLeavelDb;
exports.getValue = getValue;
exports.putValue = putValue;
exports.deleteValue = deleteValue;
const level_1 = require("level");
function openLeavelDb(dbPath) {
    return new level_1.Level(dbPath, { valueEncoding: 'json' });
}
async function getValue(db, key) {
    return (await db.get(key));
}
async function putValue(db, key, value) {
    await db.put(key, value);
}
async function deleteValue(db, key) {
    await db.del(key);
}
