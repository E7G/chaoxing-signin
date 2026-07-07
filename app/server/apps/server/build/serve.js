"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main_handler = exports.handler = exports.main = void 0;
const router_1 = __importDefault(require("@koa/router"));
const child_process_1 = require("child_process");
const koa_1 = __importDefault(require("koa"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const multiparty_1 = __importDefault(require("multiparty"));
const serverless_http_1 = __importDefault(require("serverless-http"));
const activity_1 = require("./functions/activity");
const general_1 = require("./functions/general");
const location_1 = require("./functions/location");
const photo_1 = require("./functions/photo");
const qrcode_1 = require("./functions/qrcode");
const tencent_qrcode_1 = require("./functions/tencent.qrcode");
const user_1 = require("./functions/user");
const file_1 = require("./utils/file");
const serve_boundary_1 = require("./serve-boundary");
const ENVJSON = (0, file_1.getJsonObject)('env.json');
const app = new koa_1.default();
const router = new router_1.default();
const processMap = new Map();
const savedMonitorPath = path.join(process.env.CHAOXING_DATA_DIR || path.resolve(__dirname, '../configs'), 'monitor-sessions.json');
const WEB_ROOT = path.resolve(__dirname, '../../web/dist');
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const START_TIMEOUT_MS = 10_000;
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const readSavedMonitors = () => {
    try {
        if (!fs.existsSync(savedMonitorPath))
            return {};
        return JSON.parse(fs.readFileSync(savedMonitorPath, 'utf8'));
    }
    catch {
        return {};
    }
};
const writeSavedMonitors = (data) => {
    fs.mkdirSync(path.dirname(savedMonitorPath), { recursive: true });
    fs.writeFileSync(savedMonitorPath, JSON.stringify(data), 'utf8');
};
const saveMonitorSession = (phone, rawBody) => {
    const saved = readSavedMonitors();
    saved[phone] = rawBody;
    writeSavedMonitors(saved);
};
const removeMonitorSession = (phone) => {
    const saved = readSavedMonitors();
    delete saved[phone];
    writeSavedMonitors(saved);
};
const isAllowedOrigin = (origin, host) => {
    try {
        const originUrl = new URL(origin);
        const requestHost = host.split(':')[0];
        return originUrl.hostname === requestHost || ALLOWED_LOCAL_HOSTS.has(originUrl.hostname);
    }
    catch {
        return false;
    }
};
const getMonitorToken = (ctx) => {
    const tokenFromHeader = ctx.get('X-Monitor-Token');
    if (tokenFromHeader)
        return tokenFromHeader;
    if (typeof ctx.query.monitorToken === 'string')
        return ctx.query.monitorToken;
    const body = ctx.request.body;
    if (body && typeof body.monitorToken === 'string') {
        return body.monitorToken;
    }
    return '';
};
const parseMonitorStartPayload = (rawBody) => {
    try {
        return JSON.parse(Buffer.from(rawBody, 'base64').toString('utf8'));
    }
    catch {
        return null;
    }
};
const requireFields = (body, fields) => {
    for (const field of fields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            return field;
        }
    }
    return null;
};
const createUploadForm = () => {
    return new multiparty_1.default.Form({
        maxFilesSize: MAX_UPLOAD_BYTES,
        maxFieldsSize: 64 * 1024,
    });
};
const scheduleMonitorRestart = (phone) => {
    const entry = processMap.get(phone);
    if (!entry || entry.stopping)
        return;
    const delayMs = Math.min(60_000, 2_000 * Math.max(1, entry.restartCount));
    entry.restartTimer = setTimeout(() => {
        const saved = readSavedMonitors()[phone];
        if (!saved) {
            processMap.delete(phone);
            return;
        }
        void startMonitorProcess(phone, saved, false, entry.restartCount + 1).catch((error) => {
            console.error(`[monitor:${phone}] restart failed:`, error instanceof Error ? error.message : error);
        });
    }, delayMs);
};
const startMonitorProcess = async (phone, rawBody, waitForReady, restartCount = 0) => {
    const authConfig = parseMonitorStartPayload(rawBody);
    const monitorToken = authConfig?.monitorToken;
    if (!monitorToken) {
        return { code: 400, msg: 'Missing monitor token' };
    }
    const existingMonitor = processMap.get(phone);
    if (existingMonitor !== undefined) {
        if (existingMonitor.token !== monitorToken) {
            return { code: 403, msg: 'Forbidden' };
        }
        if (existingMonitor.restartTimer)
            clearTimeout(existingMonitor.restartTimer);
        if (!existingMonitor.stopping) {
            return { code: 200, msg: 'Already started' };
        }
    }
    const process_monitor = (0, child_process_1.fork)(process.argv[1].endsWith('ts') ? 'monitor.ts' : 'monitor.js', ['--auth', phone, rawBody], {
        cwd: __dirname,
        detached: false,
        stdio: [null, null, null, 'ipc'],
    });
    const entry = {
        process: process_monitor,
        token: monitorToken,
        state: 'starting',
        rawBody,
        restartCount,
    };
    processMap.set(phone, entry);
    process_monitor.once('exit', () => {
        const current = processMap.get(phone);
        if (current !== entry)
            return;
        if (current.stopping) {
            processMap.delete(phone);
            return;
        }
        current.state = 'starting';
        scheduleMonitorRestart(phone);
    });
    process_monitor.once('error', (error) => {
        console.error(`[monitor:${phone}] process error:`, error.message);
    });
    if (!waitForReady)
        return { code: 200, msg: 'Restarting' };
    return await new Promise((resolve) => {
        const cleanupReadyListeners = () => {
            process_monitor.off('message', handleMessage);
            clearTimeout(timeoutId);
        };
        const fail = (body) => {
            cleanupReadyListeners();
            entry.stopping = true;
            process_monitor.kill('SIGKILL');
            processMap.delete(phone);
            removeMonitorSession(phone);
            resolve(body);
        };
        const handleMessage = (msg) => {
            switch (msg) {
                case 'success': {
                    entry.state = 'running';
                    saveMonitorSession(phone, rawBody);
                    cleanupReadyListeners();
                    resolve({ code: 200, msg: 'Started Successfully' });
                    break;
                }
                case 'authfail': {
                    fail({ code: 202, msg: 'Authencation Failed' });
                    break;
                }
                case 'notconfigured': {
                    fail({ code: 203, msg: 'Not Configured' });
                    break;
                }
            }
        };
        const timeoutId = setTimeout(() => {
            fail({ code: 504, msg: 'Monitor Start Timeout' });
        }, START_TIMEOUT_MS);
        process_monitor.on('message', handleMessage);
    });
};
const restoreSavedMonitors = () => {
    const saved = readSavedMonitors();
    for (const [phone, rawBody] of Object.entries(saved)) {
        void startMonitorProcess(phone, rawBody, false).catch((error) => {
            console.error(`[monitor:${phone}] restore failed:`, error instanceof Error ? error.message : error);
        });
    }
};
app.use(async (ctx, next) => {
    try {
        await next();
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[${ctx.method} ${ctx.path}] ${error.message}`);
        ctx.status = ctx.status === 200 ? 500 : ctx.status;
        ctx.body = { code: ctx.status, msg: 'Internal Server Error' };
    }
});
app.use(async (ctx, next) => {
    try {
        const fp = (0, serve_boundary_1.resolveStaticAssetPath)(WEB_ROOT, ctx.path);
        if (fp && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
            ctx.type = path.extname(fp);
            ctx.body = fs.createReadStream(fp);
            return;
        }
    }
    catch { }
    await next();
});
router.get('/', async (ctx) => {
    const fp = path.join(WEB_ROOT, 'index.html');
    if (fs.existsSync(fp)) {
        ctx.type = 'html';
        ctx.body = fs.createReadStream(fp);
    }
    else {
        ctx.body = '<h1 style="text-align: center">Welcome, chaoxing-sign-cli API service is running.</h1>';
    }
});
router.post('/login', async (ctx) => {
    const body = ctx.request.body;
    const missing = requireFields(body, ['phone', 'password']);
    if (missing) {
        ctx.status = 400;
        ctx.body = { code: 400, msg: `Missing required field: ${missing}` };
        return;
    }
    const { phone, password } = body;
    const params = await (0, user_1.userLogin)(phone, password);
    if (typeof params === 'string') {
        ctx.body = params;
        return;
    }
    params.name = (await (0, user_1.getAccountInfo)(params)) || '获取失败';
    ctx.body = params;
});
router.post('/activity', async (ctx) => {
    const body = ctx.request.body;
    const missing = requireFields(body, ['uid', '_d', 'vc3', 'uf']);
    if (missing) {
        ctx.status = 400;
        ctx.body = { code: 400, msg: `Missing required field: ${missing}` };
        return;
    }
    const { uid, _d, vc3, uf } = body;
    const courses = await (0, user_1.getCourses)(uid, _d, vc3);
    if (typeof courses === 'string') {
        ctx.body = courses;
        return;
    }
    const activity = await (0, activity_1.traverseCourseActivity)({
        courses,
        uf: uf,
        _d: _d,
        _uid: uid,
        vc3: vc3,
    });
    if (typeof activity === 'string') {
        ctx.body = activity;
        return;
    }
    await (0, activity_1.preSign)({
        uf,
        _d,
        vc3,
        _uid: uid,
        ...activity,
    });
    ctx.body = activity;
});
router.post('/qrcode', async (ctx) => {
    const { name, fid, uid, activeId, uf, _d, vc3, enc, lat, lon, address, altitude } = ctx.request.body;
    const res = await (0, qrcode_1.QRCodeSign)({
        enc,
        name,
        fid,
        _uid: uid,
        activeId,
        uf,
        _d,
        vc3,
        lat,
        lon,
        address,
        altitude
    });
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/location', async (ctx) => {
    const { uf, _d, vc3, name, uid, lat, lon, fid, address, activeId } = ctx.request.body;
    const res = await (0, location_1.LocationSign)({
        uf,
        _d,
        vc3,
        name,
        address,
        activeId,
        _uid: uid,
        lat,
        lon,
        fid,
    });
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/general', async (ctx) => {
    const { uf, _d, vc3, name, activeId, uid, fid } = ctx.request.body;
    const res = await (0, general_1.GeneralSign)({
        uf,
        _d,
        vc3,
        name,
        activeId,
        _uid: uid,
        fid,
    });
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/uvtoken', async (ctx) => {
    const { uf, _d, uid, vc3 } = ctx.request.body;
    const res = await (0, user_1.getPanToken)({
        uf,
        _d,
        _uid: uid,
        vc3,
    });
    ctx.body = JSON.parse(res);
});
router.post('/upload', async (ctx) => {
    const form = createUploadForm();
    const fields = {};
    const data = [];
    try {
        const result = await new Promise((resolve, reject) => {
            form.on('error', reject);
            form.on('part', (part) => {
                if (part.filename !== undefined) {
                    part.on('data', (chunk) => {
                        data.push(chunk);
                    });
                    part.on('close', () => {
                        part.resume();
                    });
                }
            });
            form.on('field', (name, str) => {
                fields[name] = str;
            });
            form.on('close', async () => {
                try {
                    const token = ctx.query._token;
                    if (!token) {
                        reject(new Error('Missing upload token'));
                        return;
                    }
                    const buffer = Buffer.concat(data);
                    const res = await (0, photo_1.uploadPhoto)({
                        uf: fields['uf'],
                        _d: fields['_d'],
                        _uid: fields['_uid'],
                        vc3: fields['vc3'],
                        token,
                        buffer,
                    });
                    resolve(res);
                }
                catch (error) {
                    reject(error);
                }
            });
            form.parse(ctx.req);
        });
        ctx.body = result;
    }
    catch (error) {
        ctx.status = error?.message === 'Missing upload token' ? 400 : 413;
        ctx.body = 'UploadFailed';
    }
});
router.post('/photo', async (ctx) => {
    const { uf, _d, uid, vc3, name, activeId, fid, objectId } = ctx.request.body;
    const res = await (0, photo_1.PhotoSign)({
        uf,
        _d,
        vc3,
        name,
        activeId,
        _uid: uid,
        fid,
        objectId,
    });
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/qrocr', async (ctx) => {
    const form = createUploadForm();
    const data = [];
    try {
        const result = await new Promise((resolve, reject) => {
            form.on('error', reject);
            form.on('part', (part) => {
                if (part.filename !== undefined) {
                    part.on('data', (chunk) => {
                        data.push(chunk);
                    });
                    part.on('close', () => {
                        part.resume();
                    });
                }
            });
            form.on('close', async () => {
                const buffer = Buffer.concat(data);
                const base64str = buffer.toString('base64');
                let res;
                try {
                    res = await (0, tencent_qrcode_1.QrCodeScan)(base64str, 'base64');
                    const url = res.CodeResults[0].Url;
                    const enc_start = url.indexOf('enc=') + 4;
                    const result = url.substring(enc_start, url.indexOf('&', enc_start));
                    resolve(result);
                }
                catch (error) {
                    resolve('识别失败');
                }
            });
            form.parse(ctx.req);
        });
        ctx.body = result;
    }
    catch (error) {
        console.error('[qrocr] 解析失败:', error instanceof Error ? error.message : error);
        ctx.status = 413;
        ctx.body = '识别失败';
    }
});
router.get('/monitor/status/:phone', (ctx) => {
    const entry = processMap.get(ctx.params.phone);
    if (!entry) {
        ctx.body = { code: 201, msg: 'Suspended' };
        return;
    }
    if (entry.token !== getMonitorToken(ctx)) {
        ctx.status = 403;
        ctx.body = { code: 403, msg: 'Forbidden' };
        return;
    }
    ctx.body = entry.state === 'running'
        ? { code: 200, msg: 'Monitoring' }
        : { code: 201, msg: 'Starting' };
});
router.post('/monitor/stop/:phone', (ctx) => {
    const phone = ctx.params.phone;
    const monitorProcess = processMap.get(phone);
    if (monitorProcess !== undefined) {
        if (monitorProcess.token !== getMonitorToken(ctx)) {
            ctx.status = 403;
            ctx.body = { code: 403, msg: 'Forbidden' };
            return;
        }
        monitorProcess.stopping = true;
        if (monitorProcess.restartTimer)
            clearTimeout(monitorProcess.restartTimer);
        monitorProcess.process.kill('SIGKILL');
        processMap.delete(phone);
    }
    removeMonitorSession(phone);
    ctx.body = { code: 201, msg: 'Suspended' };
});
router.post('/monitor/start/:phone', async (ctx) => {
    const rawBody = ctx.request.rawBody || '';
    const response = await startMonitorProcess(ctx.params.phone, rawBody, true);
    ctx.body = response;
});
app.use((0, koa_bodyparser_1.default)({ enableTypes: ['json', 'form', 'text'] }));
app.use(async (ctx, next) => {
    const origin = ctx.get('Origin');
    if (origin) {
        if (!isAllowedOrigin(origin, ctx.host)) {
            ctx.status = 403;
            ctx.body = { code: 403, msg: 'Forbidden Origin' };
            return;
        }
        ctx.set('Access-Control-Allow-Origin', origin);
        ctx.set('Vary', 'Origin');
        ctx.set('Access-Control-Allow-Headers', 'Content-Type, X-Monitor-Token');
        ctx.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (ctx.method === 'OPTIONS') {
        ctx.set('Access-Control-Max-Age', '300');
        ctx.status = 204;
        return;
    }
    await next();
});
app.use(router.routes());
app.use(async (ctx, next) => {
    await next();
    if (ctx.status === 404 && ctx.method === 'GET') {
        const fp = path.join(WEB_ROOT, 'index.html');
        if (fs.existsSync(fp)) {
            ctx.status = 200;
            ctx.type = 'html';
            ctx.body = fs.createReadStream(fp);
        }
    }
});
process.on('SIGINT', () => {
    processMap.forEach((monitorProcess) => {
        monitorProcess.process.kill('SIGINT');
    });
    process.exit();
});
if (!ENVJSON.env.SERVERLESS)
    app.listen(5000, () => {
        console.log('API Server: http://localhost:5000');
        restoreSavedMonitors();
    });
exports.main = (0, serverless_http_1.default)(app);
exports.handler = exports.main;
exports.main_handler = exports.main;
