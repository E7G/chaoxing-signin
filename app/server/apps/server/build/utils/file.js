"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJsonObject = exports.getStoredUser = exports.storeUser = exports.getJsonFilePath = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const BUNDLED_STORAGE_PATH = path_1.default.join(__dirname, '../configs/storage.json');
const ensureStorageFile = () => {
    const dataDir = process.env.CHAOXING_DATA_DIR;
    if (!dataDir)
        return BUNDLED_STORAGE_PATH;
    const storagePath = path_1.default.join(dataDir, 'configs', 'storage.json');
    if (!fs_1.default.existsSync(storagePath)) {
        fs_1.default.mkdirSync(path_1.default.dirname(storagePath), { recursive: true });
        fs_1.default.copyFileSync(BUNDLED_STORAGE_PATH, storagePath);
    }
    return storagePath;
};
const getJsonFilePath = (fileURL) => {
    if (fileURL === 'configs/storage.json') {
        return ensureStorageFile();
    }
    return path_1.default.join(__dirname, '../' + fileURL);
};
exports.getJsonFilePath = getJsonFilePath;
const storeUser = (phone, user) => {
    const data = (0, exports.getJsonObject)('configs/storage.json');
    let i = 0;
    user.phone = phone;
    for (; i < data.users.length; i++) {
        if (data.users[i].phone === phone) {
            data.users[i] = user;
            break;
        }
    }
    if (i === data.users.length) {
        data.users.push(user);
    }
    fs_1.default.writeFileSync((0, exports.getJsonFilePath)('configs/storage.json'), JSON.stringify(data), 'utf8');
    return data.users;
};
exports.storeUser = storeUser;
const getStoredUser = (phone) => {
    const data = (0, exports.getJsonObject)('configs/storage.json').users;
    for (let i = 0; i < data.length; i++) {
        if (data[i].phone === phone) {
            return structuredClone(data[i]);
        }
    }
    return null;
};
exports.getStoredUser = getStoredUser;
const getJsonObject = (fileURL) => {
    return JSON.parse(fs_1.default.readFileSync((0, exports.getJsonFilePath)(fileURL), 'utf8'));
};
exports.getJsonObject = getJsonObject;
