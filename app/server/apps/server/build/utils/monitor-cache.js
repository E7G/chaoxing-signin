"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorPendingQRStore = void 0;
class MonitorPendingQRStore {
    #timeoutMs;
    #now;
    #pendingByKey;
    #chatStacks;
    constructor(options = {}) {
        this.#timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
        this.#now = options.now ?? (() => Date.now());
        this.#pendingByKey = new Map();
        this.#chatStacks = new Map();
    }
    get size() {
        return this.#pendingByKey.size;
    }
    setPending(chatId, activityId, params) {
        const key = this.#buildKey(chatId, activityId);
        const stack = this.#chatStacks.get(chatId) ?? [];
        if (!stack.includes(key))
            stack.push(key);
        this.#chatStacks.set(chatId, stack);
        this.#pendingByKey.set(key, {
            chatId,
            activityId,
            params,
            expiresAt: this.#now() + this.#timeoutMs,
        });
    }
    clearPending(chatId, activityId) {
        const key = this.#buildKey(chatId, activityId);
        this.#pendingByKey.delete(key);
        const stack = this.#chatStacks.get(chatId);
        if (!stack)
            return;
        const nextStack = stack.filter((item) => item !== key);
        if (nextStack.length === 0)
            this.#chatStacks.delete(chatId);
        else
            this.#chatStacks.set(chatId, nextStack);
    }
    consumeLatest(chatId) {
        const stack = this.#chatStacks.get(chatId);
        if (!stack || stack.length === 0)
            return { entry: undefined, expiredCount: 0 };
        let expiredCount = 0;
        while (stack.length > 0) {
            const key = stack.pop();
            const entry = this.#pendingByKey.get(key);
            if (!entry)
                continue;
            this.#pendingByKey.delete(key);
            if (entry.expiresAt <= this.#now()) {
                expiredCount += 1;
                continue;
            }
            this.#cleanupStack(chatId, stack);
            return { entry, expiredCount };
        }
        this.#cleanupStack(chatId, stack);
        return { entry: undefined, expiredCount };
    }
    #cleanupStack(chatId, stack) {
        if (stack.length === 0)
            this.#chatStacks.delete(chatId);
        else
            this.#chatStacks.set(chatId, stack);
    }
    #buildKey(chatId, activityId) {
        return `${chatId}:${activityId}`;
    }
}
exports.MonitorPendingQRStore = MonitorPendingQRStore;
