"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushplusSend = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const request_1 = require("./request");
const escapeHtml = (value) => {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
function sendEmail(args) {
    const { uid, realname, aid, status, mailing } = args;
    const transporter = nodemailer_1.default.createTransport({
        host: mailing.host,
        port: mailing.port,
        secure: mailing.ssl,
        auth: {
            user: mailing.user,
            pass: mailing.pass,
        },
    });
    transporter.sendMail({
        from: `"CLI" <${mailing.user}>`,
        to: mailing.to,
        subject: '服务器签到反馈',
        html: `<table border="1"><thead><th>aid</th><th>uid</th><th>name</th><th>status</th></thead><tbody><td>${escapeHtml(aid)}</td><td>${escapeHtml(uid)}</td><td>${escapeHtml(realname)}</td><td>${escapeHtml(status)}</td></tbody></table>`,
    }, (err) => {
        if (err)
            console.error('[sendEmail] 邮件发送失败:', err.message);
        transporter.close();
    });
}
exports.sendEmail = sendEmail;
const pushplusSend = (args) => {
    return (0, request_1.request)('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }, args);
};
exports.pushplusSend = pushplusSend;
