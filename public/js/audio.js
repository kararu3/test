/**
 * ExamBuilder Pro - محرك أصوات تفاعلية ناعمة ومضمونة بدون ملفات صوت خارجية
 */
const SoundFX = {
    ctx: null,
    isMuted: false,

    init() {
        try {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.ctx = new AudioContext();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        } catch (e) {
            console.warn("AudioContext init error:", e);
        }
    },

    playTone(freq, dur, type = "sine", vol = 0.08) {
        if (this.isMuted) return;
        try {
            this.init();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + dur);
        } catch (e) {
            console.warn("PlayTone error:", e);
        }
    },

    click() {
        this.playTone(600, 0.05, "sine", 0.08);
    },

    pop() {
        this.playTone(850, 0.08, "sine", 0.09);
    },

    success() {
        this.playTone(523.25, 0.09, 'triangle', 0.09);
        setTimeout(() => this.playTone(659.25, 0.14, 'triangle', 0.09), 70);
    },

    trash() {
        this.playTone(240, 0.11, 'sawtooth', 0.06);
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
};

['click', 'keydown', 'mousedown'].forEach(eventType => {
    window.addEventListener(eventType, () => {
        SoundFX.init();
    }, { passive: true });
});