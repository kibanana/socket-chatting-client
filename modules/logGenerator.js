module.exports = {
    system: (message) => `[SYSTEM] ${message}`,
    systemDefaultError: () => `[SYSTEM] 오류가 발생했습니다. 잠시후 다시 시도해주세요.`,
    notice: (message) => `[알림] ${message}`,
    loudSpaker: (message) => `[확성기] ${message}`,
}