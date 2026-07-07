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
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachProcessExitCleanup = exports.getDefaultListenHost = exports.resolveStaticAssetPath = exports.getUploadToken = exports.getHeaderToken = void 0;
const path = __importStar(require("path"));
const STATIC_ASSET_PATTERN = /^(index.html|assets\/|.*\.(css|js|map|svg|png|jpg|jpeg|ico|txt))$/i;
const getHeaderToken = (headerValue) => {
    if (typeof headerValue === 'string')
        return headerValue;
    return '';
};
exports.getHeaderToken = getHeaderToken;
const getUploadToken = (uploadHeaderValue, queryToken) => {
    const tokenFromHeader = (0, exports.getHeaderToken)(uploadHeaderValue);
    if (tokenFromHeader)
        return tokenFromHeader;
    if (typeof queryToken === 'string')
        return queryToken;
    return '';
};
exports.getUploadToken = getUploadToken;
const resolveStaticAssetPath = (webRoot, requestPath) => {
    let decodedPath = requestPath;
    try {
        decodedPath = decodeURIComponent(requestPath);
    }
    catch {
        return null;
    }
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    if (!STATIC_ASSET_PATTERN.test(relativePath))
        return null;
    const resolvedPath = path.resolve(webRoot, relativePath);
    const relativeToRoot = path.relative(webRoot, resolvedPath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot))
        return null;
    return resolvedPath;
};
exports.resolveStaticAssetPath = resolveStaticAssetPath;
const getDefaultListenHost = (isServerless) => {
    return isServerless ? null : '127.0.0.1';
};
exports.getDefaultListenHost = getDefaultListenHost;
const attachProcessExitCleanup = (processMap, key, monitorProcess) => {
    monitorProcess.once('exit', () => {
        const existing = processMap.get(key);
        if (existing?.process === monitorProcess) {
            processMap.delete(key);
        }
    });
};
exports.attachProcessExitCleanup = attachProcessExitCleanup;
