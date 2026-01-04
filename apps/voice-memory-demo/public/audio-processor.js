// AudioWorklet processor for capturing microphone audio
// Converts Float32 audio samples to Int16 PCM format for Gemini Live API

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // Accumulate samples before sending
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];

    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      if (this.bufferIndex >= this.bufferSize) {
        // Convert Float32 to Int16 PCM
        const int16Array = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          // Clamp and convert to 16-bit signed integer
          const sample = Math.max(-1, Math.min(1, this.buffer[j]));
          int16Array[j] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        // Send PCM data to main thread
        this.port.postMessage({
          type: 'audio',
          data: int16Array.buffer,
        }, [int16Array.buffer]);

        // Reset buffer
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
