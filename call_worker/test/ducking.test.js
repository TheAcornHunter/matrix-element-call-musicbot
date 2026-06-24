const test = require("node:test");
const assert = require("node:assert/strict");

const { DuckingController, sanitizeDuckingSettings } = require("../src/ducking");

test("ducking transitions through speech, hold, and release targets", () => {
    const controller = new DuckingController(
        {
            enabled: true,
            duckToPercent: 35,
            attackMs: 120,
            releaseMs: 500,
            holdMs: 250,
            vadThreshold: 0.015,
            minActiveSpeakers: 1,
        },
        { sampleRate: 48_000, frameMs: 20 },
    );

    assert.equal(controller.getTargetGain(1.0, 0), 1.0);
    controller.setActiveSpeakers(1, 100);
    assert.equal(controller.getTargetGain(1.0, 100), 0.35);
    controller.setActiveSpeakers(0, 120);

    assert.equal(controller.getTargetGain(1.0, 340), 0.35);
    assert.equal(controller.getTargetGain(1.0, 351), 1.0);
});

test("ducking gain boundaries and ramp direction", () => {
    const settings = sanitizeDuckingSettings({
        enabled: true,
        duckToPercent: 260,
        attackMs: 80,
        releaseMs: 400,
        holdMs: 100,
        vadThreshold: 0.01,
        minActiveSpeakers: 2,
    });
    assert.equal(settings.duckToPercent, 200);

    const controller = new DuckingController(settings, { sampleRate: 48_000, frameMs: 20 });
    controller.markSpeakerEnergy("@a:example.org", 0.02, 1_000);
    controller.markSpeakerEnergy("@b:example.org", 0.02, 1_000);

    assert.equal(controller.getTargetGain(1.5, 1_000), 2.0);
    assert.equal(controller.getTargetGain(-3, 1_000), 0);

    const attackStep = controller.getRampStepPerSample(true);
    const releaseStep = controller.getRampStepPerSample(false);
    assert.ok(attackStep > releaseStep);
});
