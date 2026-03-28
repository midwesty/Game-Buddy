export class AudioManager {
  constructor(audioManifest, getSettings) {
    this.audioManifest = audioManifest;
    this.getSettings = getSettings;
    this.musicEl = new Audio();
    this.musicEl.loop = true;
    this.sfxPool = {};
  }

  applyTrack(trackId) {
    const track = this.audioManifest.music.find((m) => m.id === trackId) || this.audioManifest.music[0];
    if (!track) return;
    this.musicEl.src = track.path;
    this.musicEl.volume = 0.5;
    if (this.getSettings().musicEnabled) {
      this.musicEl.play().catch(() => {});
    }
  }

  setMusicEnabled(enabled) {
    if (enabled) this.musicEl.play().catch(() => {});
    else this.musicEl.pause();
  }

  playSfx(name, volume = 0.7) {
    if (!this.getSettings().sfxEnabled) return;
    const src = this.audioManifest.sfx[name];
    if (!src) return;
    const el = new Audio(src);
    el.volume = volume;
    el.play().catch(() => {});
  }
}
