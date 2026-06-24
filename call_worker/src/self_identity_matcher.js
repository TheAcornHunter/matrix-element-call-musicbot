const { parseMatrixUserLocalpart } = require("./matrix_identity");

function buildSelfIdentityCandidates({ userId, localParticipantIdentity }) {
    const candidates = new Set();
    if (userId) {
        candidates.add(String(userId));
        const localpart = parseMatrixUserLocalpart(userId);
        if (localpart) {
            // Some deployments expose LiveKit participant.identity as Matrix localpart
            // instead of full MXID, so keep both variants for self filtering.
            candidates.add(localpart);
        }
    }
    if (localParticipantIdentity) {
        candidates.add(String(localParticipantIdentity));
    }
    return candidates;
}

function isSelfParticipant({ participant, selfIdentityCandidates, localParticipantSid }) {
    if (!participant) {
        return false;
    }
    if (participant.isLocal === true) {
        return true;
    }
    if (participant.identity && selfIdentityCandidates?.has(String(participant.identity))) {
        return true;
    }
    if (localParticipantSid && participant.sid && participant.sid === localParticipantSid) {
        return true;
    }
    return false;
}

module.exports = {
    buildSelfIdentityCandidates,
    isSelfParticipant,
};
