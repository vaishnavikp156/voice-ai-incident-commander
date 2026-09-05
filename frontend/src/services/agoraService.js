/**
 * Agora RTC Real-Time Voice Service
 * Manages RTC channel connection, microphone publishing, volume indication,
 * and remote AI Agent audio playback using agora-rtc-sdk-ng.
 */

import AgoraRTC from "agora-rtc-sdk-ng";
import { apiService } from "./apiService";

class AgoraService {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.joined = false;
    this.isMuted = false;
    this.channelName = "incident-pay-2048";
    this.uid = Math.floor(Math.random() * 89999 + 10000); // 5-digit UID
    this.remoteUsers = new Map();
    this.logCallbacks = new Set();
    this.volumeCallbacks = new Set();
    this.remoteUserCallbacks = new Set();
  }

  log(msg, type = "info") {
    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      message: msg,
      type,
    };
    console.log(`[AgoraService][${type.toUpperCase()}] ${msg}`);
    this.logCallbacks.forEach((cb) => cb(entry));
  }

  initClient() {
    if (!this.client) {
      this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      // Handle remote user joining channel
      this.client.on("user-joined", (user) => {
        this.log(`[RTC] Remote participant joined channel: UID=${user.uid}`, "info");
        this.remoteUsers.set(user.uid, user);
        this.remoteUserCallbacks.forEach((cb) => cb(Array.from(this.remoteUsers.values())));
      });

      // Handle remote user publishing audio (e.g. Agora Conversational AI Agent)
      this.client.on("user-published", async (user, mediaType) => {
        this.log(`[RTC] Remote participant published: UID=${user.uid} (${mediaType})`, "info");
        try {
          await this.client.subscribe(user, mediaType);
          this.log(`[RTC] Subscribed to remote UID=${user.uid} (${mediaType})`, "success");

          if (mediaType === "audio") {
            if (user.audioTrack) {
              user.audioTrack.play();
              this.log(`[RTC] Playing audio track from UID=${user.uid} (Agora Conversational AI Agent)`, "success");
            } else {
              this.log(`[RTC] Warning: Remote user ${user.uid} has no audioTrack after subscribe`, "warning");
            }
          }
        } catch (err) {
          this.log(`[RTC] Failed to subscribe/play audio from UID=${user.uid}: ${err.message}`, "error");
        }

        this.remoteUsers.set(user.uid, user);
        this.remoteUserCallbacks.forEach((cb) => cb(Array.from(this.remoteUsers.values())));
      });

      // Handle remote user leaving
      this.client.on("user-unpublished", (user, mediaType) => {
        this.log(`[RTC] Remote participant unpublished: UID=${user.uid} (${mediaType})`, "info");
      });

      this.client.on("user-left", (user) => {
        this.log(`[RTC] Remote participant left: UID=${user.uid}`, "info");
        this.remoteUsers.delete(user.uid);
        this.remoteUserCallbacks.forEach((cb) => cb(Array.from(this.remoteUsers.values())));
      });

      // Volume indicator for real-time waveform & speaking detection
      this.client.enableAudioVolumeIndicator();
      this.client.on("volume-indicator", (volumes) => {
        this.volumeCallbacks.forEach((cb) => cb(volumes));
      });
    }
    return this.client;
  }

  async joinChannel({ channelName = "incident-pay-2048", uid = null } = {}) {
    if (channelName) this.channelName = channelName;
    if (uid) this.uid = uid;

    try {
      this.initClient();
      this.log(`Requesting server-side RTC token for UID=${this.uid} in channel '${this.channelName}'...`, "info");

      // 1. Fetch secure token from FastAPI backend
      const tokenData = await apiService.getAgoraToken(this.channelName, this.uid, 1);
      const { app_id: appId, token } = tokenData;

      this.log(`RTC Token received successfully (Length: ${token.length} chars)`, "success");
      this.log(`Connecting to Agora RTC channel '${this.channelName}' as UID=${this.uid}...`, "info");

      // 2. Join Agora RTC Channel
      await this.client.join(appId, this.channelName, token, this.uid);
      this.log(`Successfully connected to Agora RTC channel '${this.channelName}'`, "success");

      // 3. Create & publish local microphone audio track optimized for speech STT
      this.log("Capturing local microphone stream (speech_standard, AEC, ANS, AGC)...", "info");
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "speech_standard",
        AEC: true,
        ANS: true,
        AGC: true,
      });

      await this.client.publish([this.localAudioTrack]);
      this.log("Microphone audio track published to Agora RTC channel.", "success");

      this.joined = true;
      this.isMuted = false;

      return {
        success: true,
        channel: this.channelName,
        uid: this.uid,
      };
    } catch (err) {
      this.log(`Failed to join Agora channel: ${err.message}`, "error");
      throw err;
    }
  }

  async toggleMute() {
    if (!this.localAudioTrack) return this.isMuted;
    this.isMuted = !this.isMuted;
    await this.localAudioTrack.setEnabled(!this.isMuted);
    this.log(`Microphone ${this.isMuted ? "MUTED" : "UNMUTED"}`, this.isMuted ? "warning" : "info");
    return this.isMuted;
  }

  async leaveChannel() {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }

    if (this.client && this.joined) {
      await this.client.leave();
      this.log("Left Agora RTC channel.", "info");
    }

    this.joined = false;
    this.isMuted = false;
    this.remoteUsers.clear();
    this.remoteUserCallbacks.forEach((cb) => cb([]));

    return { success: true };
  }

  removeRemoteUser(uid) {
    let changed = false;
    if (this.remoteUsers.has(uid)) {
      this.remoteUsers.delete(uid);
      changed = true;
    }
    const numUid = Number(uid);
    if (!isNaN(numUid) && this.remoteUsers.has(numUid)) {
      this.remoteUsers.delete(numUid);
      changed = true;
    }
    const strUid = String(uid);
    if (this.remoteUsers.has(strUid)) {
      this.remoteUsers.delete(strUid);
      changed = true;
    }
    if (changed) {
      this.log(`[RTC] Removed remote UID=${uid} from local state`, "info");
      this.remoteUserCallbacks.forEach((cb) => cb(Array.from(this.remoteUsers.values())));
    }
  }

  onLog(cb) {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  onVolume(cb) {
    this.volumeCallbacks.add(cb);
    return () => this.volumeCallbacks.delete(cb);
  }

  onRemoteUsersChange(cb) {
    this.remoteUserCallbacks.add(cb);
    return () => this.remoteUserCallbacks.delete(cb);
  }
}

export const agoraService = new AgoraService();
