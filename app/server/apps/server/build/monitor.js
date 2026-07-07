"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const jsdom_1 = __importDefault(require("jsdom"));
const kolorist_1 = require("kolorist");
const prompts_1 = __importDefault(require("prompts"));
const ws_1 = __importDefault(require("ws"));
const activity_1 = require("./functions/activity");
const cq_1 = __importDefault(require("./functions/cq"));
const general_1 = require("./functions/general");
const location_1 = require("./functions/location");
const photo_1 = require("./functions/photo");
const qrcode_1 = require("./functions/qrcode");
const tencent_qrcode_1 = require("./functions/tencent.qrcode");
const user_1 = require("./functions/user");
const file_1 = require("./utils/file");
const helper_1 = require("./utils/helper");
const mailer_1 = require("./utils/mailer");
const prompts_2 = require("./configs/prompts");
const JSDOM = new jsdom_1.default.JSDOM('', { url: 'https://im.chaoxing.com/webim/me' });
globalThis.window = JSDOM.window;
globalThis.WebSocket = ws_1.default;
globalThis.navigator = JSDOM.window.navigator;
globalThis.location = JSDOM.window.location;
const webIM = require('./utils/websdk3.1.4.js').default;
const WebIMConfig = {
    xmppURL: 'https://im-api-vip6-v2.easecdn.com/ws',
    apiURL: 'https://a1-vip6.easecdn.com',
    appkey: 'cx-dev#cxstudy',
    Host: 'easemob.com',
    https: true,
    isHttpDNS: false,
    isMultiLoginSessions: true,
    isAutoLogin: true,
    isWindowSDK: false,
    isSandBox: false,
    isDebug: false,
    autoReconnectNumMax: 2,
    autoReconnectInterval: 2,
    isWebRTC: false,
    heartBeatWait: 4500,
    delivery: false,
};
const conn = new webIM.connection({
    isMultiLoginSessions: WebIMConfig.isMultiLoginSessions,
    https: WebIMConfig.https,
    url: WebIMConfig.xmppURL,
    apiUrl: WebIMConfig.apiURL,
    isAutoLogin: WebIMConfig.isAutoLogin,
    heartBeatWait: WebIMConfig.heartBeatWait,
    autoReconnectNumMax: WebIMConfig.autoReconnectNumMax,
    autoReconnectInterval: WebIMConfig.autoReconnectInterval,
    appKey: WebIMConfig.appkey,
    isHttpDNS: WebIMConfig.isHttpDNS,
});
const NORMAL_SIGN_POLL_INTERVAL = Math.max(30, Number(process.env.CHAOXING_NORMAL_SIGN_POLL_INTERVAL || 60) || 60);
async function configure(phone) {
    const config = (0, file_1.getStoredUser)(phone);
    let local = false;
    console.log((0, kolorist_1.blue)('自动签到支持 [普通/手势/拍照/签到码/位置]'));
    if (config?.monitor) {
        local = (await (0, prompts_1.default)({
            type: 'confirm',
            name: 'local',
            message: '是否用本地缓存的签到信息?',
            initial: true,
        }, prompts_2.PromptsOptions)).local;
    }
    if (!local) {
        const presetAddress = await (0, prompts_2.addressPrompts)();
        const response = await (0, prompts_1.default)(prompts_2.monitorPromptsQuestions, prompts_2.PromptsOptions);
        const monitor = {};
        const mailing = {};
        const cqserver = {};
        monitor.delay = response.delay;
        monitor.lon = response.lon;
        monitor.lat = response.lat;
        monitor.presetAddress = presetAddress;
        mailing.enabled = response.mail;
        mailing.host = response.host;
        mailing.ssl = response.ssl;
        mailing.port = response.port;
        mailing.user = response.user;
        mailing.pass = response.pass;
        mailing.to = response.to;
        cqserver.cq_enabled = response.cq_enabled;
        cqserver.ws_url = response.ws_url;
        cqserver.target_type = response.target_type;
        cqserver.target_id = response.target_id;
        config.monitor = monitor;
        config.mailing = mailing;
        config.cqserver = cqserver;
        const data = (0, file_1.getJsonObject)('configs/storage.json');
        for (let i = 0; i < data.users.length; i++) {
            if (data.users[i].phone === phone) {
                data.users[i].monitor = monitor;
                data.users[i].mailing = mailing;
                data.users[i].cqserver = cqserver;
                break;
            }
        }
        fs_1.default.writeFile((0, file_1.getJsonFilePath)('configs/storage.json'), JSON.stringify(data), 'utf8', (err) => {
            if (err)
                console.error('[configure] 配置写入失败:', err.message);
        });
    }
    return structuredClone({ mailing: config.mailing, monitor: config.monitor, cqserver: config.cqserver });
}
async function Sign(realname, params, config, activity) {
    let result = null;
    if (!activity.courseId) {
        const page = await (0, activity_1.preSign2)({ ...activity, ...params, chatId: activity.chatId });
        const activityType = (0, activity_1.speculateType)(page);
        switch (activityType) {
            case 'general': {
                result = await (0, general_1.GeneralSign_2)({ activeId: activity.activeId, ...params });
                break;
            }
            case 'photo': {
                const objectId = await (0, photo_1.getObjectIdFromcxPan)(params);
                if (objectId === null)
                    return null;
                result = await (0, photo_1.PhotoSign_2)({ objectId, activeId: activity.activeId, ...params });
                break;
            }
            case 'location': {
                result = await (0, location_1.LocationSign_2)({
                    name: realname,
                    presetAddress: config.presetAddress,
                    activeId: activity.activeId,
                    ...params,
                });
                break;
            }
            case 'qr': {
                result = '[二维码]请发送二维码照片';
                console.log((0, kolorist_1.red)('二维码签到，需人工干预！'));
                break;
            }
        }
        return result;
    }
    await (0, activity_1.preSign)({ ...activity, ...params });
    switch (activity.otherId) {
        case 2: {
            result = '[二维码]请发送二维码照片';
            console.log((0, kolorist_1.red)('二维码签到，需人工干预！'));
            break;
        }
        case 4: {
            result = await (0, location_1.LocationSign)({
                name: realname,
                presetAddress: config.presetAddress,
                activeId: activity.activeId,
                ...params,
            });
            break;
        }
        case 3: {
            result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
            break;
        }
        case 5: {
            result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
            break;
        }
        case 0: {
            if (activity.ifphoto === 0) {
                result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
                break;
            }
            else {
                const objectId = await (0, photo_1.getObjectIdFromcxPan)(params);
                if (objectId === null)
                    return null;
                result = await (0, photo_1.PhotoSign)({ name: realname, activeId: activity.activeId, objectId, ...params });
                break;
            }
        }
    }
    return result;
}
async function handleMsg(data) {
    if (cq_1.default.hasImage(data) && this.getCache('params') !== undefined) {
        console.log('[图片]尝试二维码识别');
        const img_matches = data.match(/https:\/\/[\S]+[^\]]/g);
        if (!img_matches || img_matches.length === 0) {
            console.error('[handleMsg] 无法从消息中提取图片URL');
            return;
        }
        const img_url = img_matches[0];
        const params = this.getCache('params');
        const qr_str = (await (0, tencent_qrcode_1.QrCodeScan)(img_url, 'url')).CodeResults?.[0].Url;
        if (typeof qr_str === 'undefined')
            this.send('是否已配置腾讯云OCR？图像是否包含清晰二维码？', this.getTargetID());
        else {
            params.enc = qr_str.match(/(?<=&enc=)[\dA-Z]+/)?.[0];
            const result = await (0, qrcode_1.QRCodeSign)(params);
            this.send(`${result} - ${params.name}`, this.getTargetID());
            result === '[二维码]签到成功' ? this.clearCache() : this.send(result, this.getTargetID());
        }
    }
}
async function notifySignResult(args) {
    if (args.config.mailing?.enabled) {
        (0, mailer_1.sendEmail)({
            aid: args.activeId,
            uid: args.params._uid,
            realname: args.realname,
            status: args.result,
            mailing: args.config.mailing,
        });
    }
    if (args.config.cqserver?.cq_enabled && args.cq) {
        args.cq.send(`${args.result} - ${args.realname}`, args.config.cqserver.target_id);
    }
}
async function startNormalSignPolling(args) {
    const handledActiveIds = new Set();
    const pendingActiveIds = new Set();
    const trySignActivity = async (activity) => {
        if (handledActiveIds.has(activity.activeId) || pendingActiveIds.has(activity.activeId))
            return;
        pendingActiveIds.add(activity.activeId);
        try {
            const PPTActiveInfo = await (0, activity_1.getPPTActiveInfo)({ activeId: activity.activeId, ...args.params });
            if (Number(PPTActiveInfo.otherId) !== 0 || Number(PPTActiveInfo.ifphoto) !== 0)
                return;
            console.log(`[普通签到轮询] 检测到普通签到: ${activity.activeId}`);
            if (args.config.cqserver?.cq_enabled && args.cq) {
                args.cq.send(`${args.realname}，轮询检测到普通签到，将在${args.config.monitor.delay}秒后处理`, args.config.cqserver.target_id);
            }
            await (0, helper_1.delay)(args.config.monitor.delay);
            const result = await Sign(args.realname, args.params, args.config.monitor, {
                ...activity,
                otherId: 0,
                ifphoto: 0,
            });
            handledActiveIds.add(activity.activeId);
            await notifySignResult({
                activeId: activity.activeId,
                result,
                params: args.params,
                realname: args.realname,
                config: args.config,
                cq: args.cq,
            });
        }
        catch (error) {
            console.error('[普通签到轮询] 签到失败:', error instanceof Error ? error.message : error);
        }
        finally {
            pendingActiveIds.delete(activity.activeId);
        }
    };
    const poll = async () => {
        try {
            const courses = await (0, user_1.getCourses)(args.params._uid, args.params._d, args.params.vc3);
            if (!Array.isArray(courses))
                return;
            for (const course of courses) {
                try {
                    const activities = await (0, activity_1.getActivities)({ course, ...args.params });
                    for (const activity of activities) {
                        void trySignActivity(activity);
                    }
                }
                catch {
                }
            }
        }
        catch (error) {
            console.error('[普通签到轮询] 查询失败:', error instanceof Error ? error.message : error);
        }
    };
    void poll();
    setInterval(() => {
        void poll();
    }, NORMAL_SIGN_POLL_INTERVAL * 1000);
}
process.on('SIGINT', () => {
    process.exit(0);
});
(async () => {
    let params = {};
    let config = {};
    if (process.argv[2] === '--auth') {
        const auth_config = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf8'));
        params.phone = auth_config.credentials.phone;
        params.uf = auth_config.credentials.uf;
        params._d = auth_config.credentials._d;
        params.vc3 = auth_config.credentials.vc3;
        params._uid = auth_config.credentials.uid;
        params.lv = auth_config.credentials.lv;
        params.fid = auth_config.credentials.fid;
        config.monitor = { ...auth_config.config.monitor };
        config.mailing = { ...auth_config.config.mailing };
        config.cqserver = { ...auth_config.config.cqserver };
    }
    else {
        const userItem = (await (0, prompts_1.default)({ type: 'select', name: 'userItem', message: '选择用户', choices: (0, user_1.getLocalUsers)(), initial: 0 }, prompts_2.PromptsOptions)).userItem;
        if (userItem === -1) {
            const phone = (await (0, prompts_1.default)({ type: 'text', name: 'phone', message: '手机号' }, prompts_2.PromptsOptions)).phone;
            const password = (await (0, prompts_1.default)({ type: 'password', name: 'password', message: '密码' }, prompts_2.PromptsOptions)).password;
            params = await (0, user_1.userLogin)(phone, password);
            if (params === 'AuthFailed')
                process.exit(0);
            (0, file_1.storeUser)(phone, { phone, params });
            params.phone = phone;
        }
        else {
            const user = (0, file_1.getJsonObject)('configs/storage.json').users[userItem];
            params = user.params;
            params.phone = user.phone;
        }
        config = await configure(params.phone);
    }
    const IM_Params = await (0, user_1.getIMParams)(params);
    if (IM_Params === 'AuthFailed') {
        if (process.send)
            process.send('authfail');
        process.exit(0);
    }
    params.tuid = IM_Params.myTuid;
    params.name = IM_Params.myName;
    let cq;
    if (config.cqserver?.cq_enabled) {
        cq = new cq_1.default(config.cqserver.ws_url, config.cqserver.target_type, config.cqserver.target_id);
        cq.connect();
        cq.onMessage(handleMsg);
    }
    await startNormalSignPolling({
        params,
        config,
        realname: IM_Params.myName,
        cq: cq,
    });
    conn.open({
        apiUrl: WebIMConfig.apiURL,
        user: IM_Params.myTuid,
        accessToken: IM_Params.myToken,
        appKey: WebIMConfig.appkey,
    });
    conn.listen({
        onOpened: () => {
            if (process.send)
                process.send('success');
        },
        onClosed: () => {
            console.log('[监听停止]');
            process.exit(0);
        },
        onTextMessage: async (message) => {
            if (message?.ext?.attachment?.att_chat_course?.url.includes('sign')) {
                const IM_CourseInfo = {
                    aid: message.ext.attachment.att_chat_course.aid,
                    classId: message.ext.attachment.att_chat_course?.courseInfo?.classid,
                    courseId: message.ext.attachment.att_chat_course?.courseInfo?.courseid,
                };
                const PPTActiveInfo = await (0, activity_1.getPPTActiveInfo)({ activeId: IM_CourseInfo.aid, ...params });
                if (config.cqserver?.cq_enabled) {
                    cq.send(`${IM_Params.myName}，检测到${(0, activity_1.getSignType)(PPTActiveInfo)}，将在${config.monitor.delay}秒后处理`, config.cqserver.target_id);
                    cq.setCache('params', { ...params, activeId: IM_CourseInfo.aid });
                }
                await (0, helper_1.delay)(config.monitor.delay);
                const result = await Sign(IM_Params.myName, params, config.monitor, {
                    classId: IM_CourseInfo.classId,
                    courseId: IM_CourseInfo.courseId,
                    activeId: IM_CourseInfo.aid,
                    otherId: PPTActiveInfo.otherId,
                    ifphoto: PPTActiveInfo.ifphoto,
                    chatId: message?.to,
                });
                await notifySignResult({
                    activeId: IM_CourseInfo.aid,
                    result,
                    params,
                    realname: IM_Params.myName,
                    config,
                    cq: cq,
                });
            }
        },
        onError: (msg) => {
            console.log((0, kolorist_1.red)('[发生异常]'), msg);
            process.exit(0);
        },
    });
    console.log((0, kolorist_1.blue)(`[监听中] ${config.cqserver.cq_enabled ? 'CQ服务器已连接' : ''} ${config.mailing?.enabled ? '邮件推送已开启' : ''}...`));
})();
