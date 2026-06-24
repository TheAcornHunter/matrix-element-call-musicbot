const LEGACY_VOLUME_RAMP_STEP_PER_SAMPLE = 0.0005;

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function sanitizeDuckingSettings(input = {}) {
    const normalized = {
        enabled: Boolean(input.enabled),
        duckToPercent: Math.trunc(clampNumber(input.duckToPercent ?? 35, 0, 200)),
        attackMs: Math.max(0, Math.trunc(clampNumber(input.attackMs ?? 120, 0, Number.MAX_SAFE_INTEGER))),
        releaseMs: Math.max(0, Math.trunc(clampNumber(input.releaseMs ?? 500, 0, Number.MAX_SAFE_INTEGER))),
        holdMs: Math.max(0, Math.trunc(clampNumber(input.holdMs ?? 250, 0, Number.MAX_SAFE_INTEGER))),
        vadThreshold: clampNumber(input.vadThreshold ?? 0.015, 0, 1),
        minActiveSpeakers: Math.max(
            1,
            Math.trunc(clampNumber(input.minActiveSpeakers ?? 1, 1, Number.MAX_SAFE_INTEGER)),
        ),
    };
    return normalized;
}

class DuckingController {
    constructor(settings = {}, options = {}) {
        this.sampleRate = Math.max(1, Math.trunc(clampNumber(options.sampleRate ?? 48000, 1, Number.MAX_SAFE_INTEGER)));
        this.frameMs = Math.max(1, Math.trunc(clampNumber(options.frameMs ?? 20, 1, Number.MAX_SAFE_INTEGER)));
        this.settings = sanitizeDuckingSettings(settings);
        this.activityWindowMs = Math.max(this.frameMs * 2, 80);
        this.holdUntilMs = 0;
        this.primarySpeakerCount = 0;
        this.energySpeakerLastActiveMs = new Map();
    }

    updateSettings(settings = {}) {
        this.settings = sanitizeDuckingSettings({ ...this.settings, ...settings });
        if (!this.settings.enabled) {
            this.primarySpeakerCount = 0;
            this.holdUntilMs = 0;
            this.energySpeakerLastActiveMs.clear();
        }
    }

    setActiveSpeakers(count, nowMs = Date.now()) {
        if (!this.settings.enabled) {
            this.primarySpeakerCount = 0;
            return;
        }
        this.primarySpeakerCount = Math.max(0, Math.trunc(clampNumber(count, 0, Number.MAX_SAFE_INTEGER)));
        if (this.primarySpeakerCount >= this.settings.minActiveSpeakers) {
            this._noteSpeech(nowMs);
        }
    }

    markSpeakerEnergy(speakerId, rmsNormalized, nowMs = Date.now()) {
        if (!this.settings.enabled || !speakerId) {
            return;
        }
        if (Number.isFinite(rmsNormalized) && rmsNormalized >= this.settings.vadThreshold) {
            this.energySpeakerLastActiveMs.set(String(speakerId), nowMs);
        }
        const activeByEnergy = this._countEnergyActive(nowMs);
        if (activeByEnergy >= this.settings.minActiveSpeakers) {
            this._noteSpeech(nowMs);
        }
    }

    isSpeechActive(nowMs = Date.now()) {
        if (!this.settings.enabled) {
            return false;
        }
        if (this.primarySpeakerCount >= this.settings.minActiveSpeakers) {
            return true;
        }
        if (this._countEnergyActive(nowMs) >= this.settings.minActiveSpeakers) {
            return true;
        }
        return nowMs < this.holdUntilMs;
    }

    getTargetGain(baseGain, nowMs = Date.now()) {
        const normalizedBase = clampNumber(baseGain, 0, 2);
        if (!this.settings.enabled) {
            return normalizedBase;
        }
        if (!this.isSpeechActive(nowMs)) {
            return normalizedBase;
        }
        return clampNumber(normalizedBase * (this.settings.duckToPercent / 100), 0, 2);
    }

    getRampStepPerSample(isAttack) {
        if (!this.settings.enabled) {
            return LEGACY_VOLUME_RAMP_STEP_PER_SAMPLE;
        }
        const durationMs = isAttack ? this.settings.attackMs : this.settings.releaseMs;
        if (durationMs <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        const samplesToMoveFullScale = Math.max(1, (this.sampleRate * durationMs) / 1000);
        return 1 / samplesToMoveFullScale;
    }

    _noteSpeech(nowMs) {
        this.holdUntilMs = Math.max(this.holdUntilMs, nowMs + this.settings.holdMs);
    }

    _countEnergyActive(nowMs) {
        const cutoff = nowMs - this.activityWindowMs;
        let count = 0;
        for (const [speakerId, lastActive] of this.energySpeakerLastActiveMs.entries()) {
            if (lastActive >= cutoff) {
                count += 1;
            } else {
                this.energySpeakerLastActiveMs.delete(speakerId);
            }
        }
        return count;
    }
}

module.exports = {
    DuckingController,
    sanitizeDuckingSettings,
    LEGACY_VOLUME_RAMP_STEP_PER_SAMPLE,
    clampNumber,
};
