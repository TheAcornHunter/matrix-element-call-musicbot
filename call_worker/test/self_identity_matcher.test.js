const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSelfIdentityCandidates, isSelfParticipant } = require("../src/self_identity_matcher");

test("buildSelfIdentityCandidates includes mxid, localpart, and local identity", () => {
    const candidates = buildSelfIdentityCandidates({
        userId: "@musicbot:example.org",
        localParticipantIdentity: "livekit-musicbot",
    });
    assert.ok(candidates.has("@musicbot:example.org"));
    assert.ok(candidates.has("musicbot"));
    assert.ok(candidates.has("livekit-musicbot"));
});

test("buildSelfIdentityCandidates handles missing identities", () => {
    const candidates = buildSelfIdentityCandidates({ userId: "", localParticipantIdentity: "" });
    assert.equal(candidates.size, 0);
});

test("isSelfParticipant handles null participant", () => {
    assert.equal(
        isSelfParticipant({
            participant: null,
            selfIdentityCandidates: new Set(["@musicbot:example.org"]),
            localParticipantSid: "local-sid",
        }),
        false,
    );
});

test("isSelfParticipant detects explicit local participant", () => {
    assert.equal(
        isSelfParticipant({
            participant: { isLocal: true },
            selfIdentityCandidates: new Set(),
            localParticipantSid: null,
        }),
        true,
    );
});

test("isSelfParticipant detects matching identity candidate", () => {
    assert.equal(
        isSelfParticipant({
            participant: { identity: "musicbot" },
            selfIdentityCandidates: new Set(["musicbot"]),
            localParticipantSid: null,
        }),
        true,
    );
});

test("isSelfParticipant detects matching local sid", () => {
    assert.equal(
        isSelfParticipant({
            participant: { sid: "local-sid" },
            selfIdentityCandidates: new Set(),
            localParticipantSid: "local-sid",
        }),
        true,
    );
});

test("isSelfParticipant returns false for non-self participant", () => {
    assert.equal(
        isSelfParticipant({
            participant: { identity: "other-user", sid: "remote-sid" },
            selfIdentityCandidates: new Set(["musicbot"]),
            localParticipantSid: "local-sid",
        }),
        false,
    );
});
