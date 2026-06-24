const test = require("node:test");
const assert = require("node:assert/strict");

const { parseMatrixUserLocalpart } = require("../src/matrix_identity");

test("parseMatrixUserLocalpart extracts localpart from valid mxid", () => {
    assert.equal(parseMatrixUserLocalpart("@musicbot:example.org"), "musicbot");
});

test("parseMatrixUserLocalpart returns empty string for malformed mxid", () => {
    assert.equal(parseMatrixUserLocalpart("musicbot"), "");
    assert.equal(parseMatrixUserLocalpart("@musicbot"), "");
    assert.equal(parseMatrixUserLocalpart("@:example.org"), "");
});

test("parseMatrixUserLocalpart trims outer whitespace", () => {
    assert.equal(parseMatrixUserLocalpart("  @musicbot:example.org  "), "musicbot");
});
