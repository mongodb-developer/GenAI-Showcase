// source: https://github.com/Azure-Samples/aisearch-openai-rag-audio/blob/7f685a8969e3b63e8c3ef345326c21f5ab82b1c3/app/frontend/public/audio-playback-worklet.js
class AudioPlaybackWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = this.handleMessage.bind(this);
        this.buffer = [];
        this.isPlaying = true;
    }

    handleMessage(event) {
        if (event.data === null) {
            // Clear buffer and stop playback on interrupt
            this.buffer = [];
            this.isPlaying = false;
            // Notify the main thread that audio has been stopped
            this.port.postMessage('stopped');
            return;
        }
        if (event.data === 'resume') {
            // Resume playback
            this.isPlaying = true;
            return;
        }
        if (this.isPlaying) {
            this.buffer.push(...event.data);
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (!this.isPlaying) {
            // Fill channel with silence when not playing
            channel.fill(0);
            return true;
        }

        if (this.buffer.length > channel.length) {
            const toProcess = this.buffer.slice(0, channel.length);
            this.buffer = this.buffer.slice(channel.length);
            channel.set(toProcess.map(v => v / 32768));
        } else {
            channel.set(this.buffer.map(v => v / 32768));
            this.buffer = [];
        }

        return true;
    }
}

registerProcessor("audio-playback-worklet", AudioPlaybackWorklet);
