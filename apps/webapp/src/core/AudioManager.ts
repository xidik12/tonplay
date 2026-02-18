/**
 * Singleton audio manager for game sounds using Web Audio API.
 * Provides BGM playback with looping and one-shot SFX.
 */

interface AudioTrack {
  buffer: AudioBuffer;
  source?: AudioBufferSourceNode;
  gainNode?: GainNode;
}

export class AudioManager {
  private static instance: AudioManager;
  private context: AudioContext | null = null;
  private tracks: Map<string, AudioTrack> = new Map();
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private currentBgm: string | null = null;
  private _isMuted = false;
  private _bgmVolume = 0.5;
  private _sfxVolume = 0.7;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();

      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);

      this.bgmGain = this.context.createGain();
      this.bgmGain.gain.value = this._bgmVolume;
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.context.createGain();
      this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }

    // Resume context if suspended (browsers require user gesture)
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }

    return this.context;
  }

  /**
   * Load an audio file into the buffer cache.
   */
  async loadAudio(key: string, url: string): Promise<void> {
    if (this.tracks.has(key)) return;

    const ctx = this.ensureContext();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.tracks.set(key, { buffer: audioBuffer });
    } catch (err) {
      console.warn(`[AudioManager] Failed to load audio '${key}':`, err);
    }
  }

  /**
   * Play background music with looping.
   * Stops any currently playing BGM.
   */
  playBgm(key: string): void {
    if (this._isMuted) return;

    const track = this.tracks.get(key);
    if (!track) {
      console.warn(`[AudioManager] BGM track '${key}' not loaded`);
      return;
    }

    // Stop current BGM
    this.stopBgm();

    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true;
    source.connect(this.bgmGain!);
    source.start(0);

    track.source = source;
    this.currentBgm = key;
  }

  /**
   * Stop the current background music.
   */
  stopBgm(): void {
    if (this.currentBgm) {
      const track = this.tracks.get(this.currentBgm);
      if (track?.source) {
        try {
          track.source.stop();
        } catch {
          // Already stopped
        }
        track.source = undefined;
      }
      this.currentBgm = null;
    }
  }

  /**
   * Play a one-shot sound effect.
   */
  playSfx(key: string): void {
    if (this._isMuted) return;

    const track = this.tracks.get(key);
    if (!track) {
      console.warn(`[AudioManager] SFX track '${key}' not loaded`);
      return;
    }

    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.connect(this.sfxGain!);
    source.start(0);
  }

  /**
   * Set volume levels for BGM and SFX.
   * @param bgm Volume from 0 to 1
   * @param sfx Volume from 0 to 1
   */
  setVolume(bgm: number, sfx: number): void {
    this._bgmVolume = Math.max(0, Math.min(1, bgm));
    this._sfxVolume = Math.max(0, Math.min(1, sfx));

    if (this.bgmGain) {
      this.bgmGain.gain.value = this._bgmVolume;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this._sfxVolume;
    }
  }

  /**
   * Mute all audio.
   */
  mute(): void {
    this._isMuted = true;
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  /**
   * Unmute all audio.
   */
  unmute(): void {
    this._isMuted = false;
    if (this.masterGain) {
      this.masterGain.gain.value = 1;
    }
  }

  /**
   * Toggle mute state.
   */
  toggleMute(): boolean {
    if (this._isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this._isMuted;
  }

  /**
   * Clean up all audio resources.
   */
  destroy(): void {
    this.stopBgm();
    this.tracks.clear();
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
    this.bgmGain = null;
    this.sfxGain = null;
    this.masterGain = null;
  }
}
