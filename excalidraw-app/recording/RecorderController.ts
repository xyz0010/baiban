import type { RecordingSettings } from "./types";
import { isWebCodecsSupported, WebCodecsRecorder } from "./webCodecsRecorder";

export type RecordingBackend = "webcodecs" | "mediarecorder";

export type RecordingStartResult = {
  backend: RecordingBackend;
  mimeType: string;
  extension: "mp4" | "webm";
};

export type RecordingStopResult = {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
};

const pickMediaRecorderMimeType = () => {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const mimeType of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
};

export class RecorderController {
  private webCodecsRecorder: WebCodecsRecorder | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaRecorderMimeType: string | null = null;
  private mediaRecorderChunks: BlobPart[] = [];
  private stopMediaRecorderPromise: Promise<RecordingStopResult> | null = null;
  private stopMediaRecorderResolve:
    | ((value: RecordingStopResult | PromiseLike<RecordingStopResult>) => void)
    | null = null;
  private stopMediaRecorderReject: ((reason?: any) => void) | null = null;

  get backend(): RecordingBackend | null {
    if (this.webCodecsRecorder) {
      return "webcodecs";
    }
    if (this.mediaRecorder) {
      return "mediarecorder";
    }
    return null;
  }

  get isRecording(): boolean {
    if (this.webCodecsRecorder) {
      return this.webCodecsRecorder.isRecording;
    }
    if (this.mediaRecorder) {
      return this.mediaRecorder.state !== "inactive";
    }
    return false;
  }

  get isPaused(): boolean {
    if (this.webCodecsRecorder) {
      return this.webCodecsRecorder.isPaused;
    }
    if (this.mediaRecorder) {
      return this.mediaRecorder.state === "paused";
    }
    return false;
  }

  async start(opts: {
    canvas: HTMLCanvasElement;
    settings: RecordingSettings;
    audioStream?: MediaStream;
  }): Promise<RecordingStartResult> {
    this.assertNotRecording();

    if (isWebCodecsSupported()) {
      const recorder = new WebCodecsRecorder({
        width: opts.canvas.width,
        height: opts.canvas.height,
        frameRate: opts.settings.frameRate,
        videoBitrate: opts.settings.videoBitrate,
        audioBitrate: opts.settings.audioBitrate,
        audioStream: opts.audioStream,
      });
      await recorder.start();
      this.webCodecsRecorder = recorder;
      return { backend: "webcodecs", mimeType: "video/mp4", extension: "mp4" };
    }

    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder not supported");
    }

    const mimeType = pickMediaRecorderMimeType();
    const stream = opts.canvas.captureStream(opts.settings.frameRate);
    const audioTracks = opts.audioStream?.getAudioTracks() ?? [];
    const mixedStream = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);

    const mediaRecorder = new MediaRecorder(
      mixedStream,
      mimeType ? { mimeType } : undefined,
    );

    this.mediaRecorder = mediaRecorder;
    this.mediaRecorderMimeType = mimeType || mediaRecorder.mimeType || "video/webm";
    this.mediaRecorderChunks = [];
    this.stopMediaRecorderPromise = new Promise<RecordingStopResult>((resolve, reject) => {
      this.stopMediaRecorderResolve = resolve;
      this.stopMediaRecorderReject = reject;
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.mediaRecorderChunks.push(event.data);
      }
    };
    mediaRecorder.onerror = () => {
      this.stopMediaRecorderReject?.(new Error("MediaRecorder error"));
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(this.mediaRecorderChunks, { type: this.mediaRecorderMimeType! });
      this.stopMediaRecorderResolve?.({
        blob,
        mimeType: this.mediaRecorderMimeType!,
        extension: "webm",
      });
      this.cleanupMediaRecorder();
    };

    mediaRecorder.start(1_000);
    return {
      backend: "mediarecorder",
      mimeType: this.mediaRecorderMimeType,
      extension: "webm",
    };
  }

  addFrame(canvas: HTMLCanvasElement | OffscreenCanvas) {
    if (this.webCodecsRecorder) {
      this.webCodecsRecorder.addFrame(canvas);
    }
  }

  pause() {
    if (this.webCodecsRecorder) {
      this.webCodecsRecorder.pause();
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
    }
  }

  resume() {
    if (this.webCodecsRecorder) {
      this.webCodecsRecorder.resume();
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
    }
  }

  async stop(): Promise<RecordingStopResult> {
    if (this.webCodecsRecorder) {
      const blob = await this.webCodecsRecorder.stop();
      this.webCodecsRecorder = null;
      return { blob, mimeType: "video/mp4", extension: "mp4" };
    }
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
      }
      if (!this.stopMediaRecorderPromise) {
        throw new Error("Stop promise missing");
      }
      return this.stopMediaRecorderPromise;
    }
    throw new Error("Not recording");
  }

  private assertNotRecording() {
    if (this.webCodecsRecorder || this.mediaRecorder) {
      throw new Error("Recorder already started");
    }
  }

  private cleanupMediaRecorder() {
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onerror = null;
      this.mediaRecorder.onstop = null;
    }
    this.mediaRecorder = null;
    this.mediaRecorderMimeType = null;
    this.mediaRecorderChunks = [];
    this.stopMediaRecorderPromise = null;
    this.stopMediaRecorderResolve = null;
    this.stopMediaRecorderReject = null;
  }
}

