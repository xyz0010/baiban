import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export const isWebCodecsSupported = (): boolean => {
  return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";
};

export type WebCodecsRecorderOptions = {
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  audioBitrate: number;
  audioStream?: MediaStream;
};

export class WebCodecsRecorder {
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private audioEncoder: AudioEncoder | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioScriptNode: ScriptProcessorNode | null = null;

  private width: number;
  private height: number;
  private frameRate: number;
  private videoBitrate: number;
  private audioBitrate: number;
  private audioStream: MediaStream | null;

  private frameCount = 0;
  private recording = false;
  private paused = false;
  private audioSampleRate = 48_000;
  private warmupFrames = 5;
  private audioTimestamp = 0;
  private videoCodec: string | null = null;

  constructor(options: WebCodecsRecorderOptions) {
    this.width = options.width;
    this.height = options.height;
    this.frameRate = options.frameRate;
    this.videoBitrate = options.videoBitrate;
    this.audioBitrate = options.audioBitrate;
    this.audioStream = options.audioStream ?? null;
  }

  async start(): Promise<void> {
    this.videoCodec = await this.pickSupportedVideoCodec();
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: this.width, height: this.height },
      audio: this.audioStream
        ? { codec: "aac", numberOfChannels: 1, sampleRate: this.audioSampleRate }
        : undefined,
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        this.muxer?.addVideoChunk(chunk, meta);
      },
      error: () => undefined,
    });

    this.videoEncoder.configure({
      codec: this.videoCodec,
      width: this.width,
      height: this.height,
      bitrate: this.videoBitrate,
      framerate: this.frameRate,
      latencyMode: "realtime",
    });

    await this.videoEncoder.flush();

    if (this.audioStream) {
      await this.setupAudioEncoder();
    }

    this.frameCount = 0;
    this.recording = true;
    this.paused = false;
  }

  private async setupAudioEncoder(): Promise<void> {
    if (!this.audioStream) {
      return;
    }

    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        this.muxer?.addAudioChunk(chunk, meta);
      },
      error: () => undefined,
    });

    this.audioEncoder.configure({
      codec: "mp4a.40.2",
      numberOfChannels: 1,
      sampleRate: this.audioSampleRate,
      bitrate: this.audioBitrate,
    });

    this.audioContext = new AudioContext({ sampleRate: this.audioSampleRate });
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    const audioTrack = this.audioStream.getAudioTracks()[0];
    if (!audioTrack) {
      return;
    }
    audioTrack.enabled = true;

    const audioOnlyStream = new MediaStream([audioTrack]);
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(audioOnlyStream);

    const bufferSize = 4096;
    const scriptNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    this.audioScriptNode = scriptNode;

    scriptNode.onaudioprocess = (event) => {
      if (!this.recording || this.paused || !this.audioEncoder) {
        return;
      }
      if (this.audioEncoder.state === "closed") {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const int16Data = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const audioData = new AudioData({
        format: "s16",
        sampleRate: this.audioSampleRate,
        numberOfFrames: int16Data.length,
        numberOfChannels: 1,
        timestamp: this.audioTimestamp,
        data: int16Data,
      });

      this.audioTimestamp += (int16Data.length / this.audioSampleRate) * 1_000_000;

      try {
        this.audioEncoder.encode(audioData);
      } catch {
        return;
      } finally {
        audioData.close();
      }
    };

    this.mediaStreamSource.connect(scriptNode);
    scriptNode.connect(this.audioContext.destination);
  }

  private async pickSupportedVideoCodec(): Promise<string> {
    const candidates = ["avc1.42E01E", "avc1.4D401E", "avc1.640028"];
    if (typeof VideoEncoder === "undefined") {
      return candidates[candidates.length - 1];
    }
    if (typeof VideoEncoder.isConfigSupported !== "function") {
      return candidates[candidates.length - 1];
    }
    for (const codec of candidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width: this.width,
          height: this.height,
          bitrate: this.videoBitrate,
          framerate: this.frameRate,
          latencyMode: "realtime",
        });
        if (support.supported) {
          return codec;
        }
      } catch {
        continue;
      }
    }
    return candidates[candidates.length - 1];
  }

  addFrame(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    if (!this.recording || this.paused || !this.videoEncoder) {
      return;
    }

    if (this.frameCount < this.warmupFrames) {
      this.frameCount++;
      return;
    }

    const adjustedFrame = this.frameCount - this.warmupFrames;
    const timestamp = (adjustedFrame * 1_000_000) / this.frameRate;
    const frame = new VideoFrame(canvas, {
      timestamp,
      duration: 1_000_000 / this.frameRate,
    });

    const keyFrame = adjustedFrame === 0 || adjustedFrame % (this.frameRate * 2) === 0;
    this.videoEncoder.encode(frame, { keyFrame });
    frame.close();
    this.frameCount++;
  }

  pause(): void {
    if (!this.recording || this.paused) {
      return;
    }
    this.paused = true;
  }

  resume(): void {
    if (!this.recording || !this.paused) {
      return;
    }
    this.paused = false;
  }

  async stop(): Promise<Blob> {
    if (!this.recording) {
      throw new Error("Not recording");
    }

    this.recording = false;

    if (this.videoEncoder) {
      await this.videoEncoder.flush();
      this.videoEncoder.close();
      this.videoEncoder = null;
    }

    if (this.audioEncoder) {
      if (this.audioScriptNode) {
        this.audioScriptNode.onaudioprocess = null;
        this.audioScriptNode.disconnect();
        this.audioScriptNode = null;
      }
      if (this.mediaStreamSource) {
        this.mediaStreamSource.disconnect();
        this.mediaStreamSource = null;
      }
      if (this.audioEncoder.state !== "closed") {
        try {
          await this.audioEncoder.flush();
        } catch {
          // ignore closed/invalid state during shutdown
        }
        this.audioEncoder.close();
      }
      this.audioEncoder = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (!this.muxer) {
      throw new Error("Muxer not initialized");
    }

    this.muxer.finalize();
    const { buffer } = this.muxer.target;
    this.muxer = null;
    return new Blob([buffer], { type: "video/mp4" });
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get isPaused(): boolean {
    return this.paused;
  }
}
