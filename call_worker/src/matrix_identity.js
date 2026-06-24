function parseMatrixUserLocalpart(userId) {
    if (typeof userId !== "string") return "";
    const trimmed = userId.trim();
    if (!trimmed.startsWith("@")) return "";
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex <= 1) return "";
    return trimmed.slice(1, colonIndex);
}

module.exports = {
    parseMatrixUserLocalpart,
};
