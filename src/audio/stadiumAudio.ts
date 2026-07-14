type StadiumCue = 'whistle' | 'kick' | 'tackle' | 'save' | 'card' | 'goal' | 'boo'

class StadiumAudioEngine {
  private context?: AudioContext
  private master?: GainNode
  private crowdGain?: GainNode
  private crowdSource?: AudioBufferSourceNode
  private enabled = true
  private intensity = 0.28
  private volume = 0.55

  private async ensureContext() {
    if (!this.enabled) return undefined
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.context.destination)
      this.startCrowd()
    }
    if (this.context.state === 'suspended') await this.context.resume()
    return this.context
  }

  private noiseBuffer(seconds: number) {
    const context = this.context!
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let last = 0
    for (let index = 0; index < channel.length; index += 1) {
      const white = Math.random() * 2 - 1
      last = last * 0.985 + white * 0.15
      channel[index] = last * 0.55 + white * 0.08
    }
    return buffer
  }

  private startCrowd() {
    if (!this.context || !this.master) return
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer(4)
    source.loop = true
    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 720
    band.Q.value = 0.45
    const gain = this.context.createGain()
    gain.gain.value = this.intensity
    source.connect(band).connect(gain).connect(this.master)
    source.start()
    this.crowdSource = source
    this.crowdGain = gain
  }

  async unlock() {
    await this.ensureContext()
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (this.master) this.master.gain.value = enabled ? this.volume : 0
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.master && this.enabled) this.master.gain.value = this.volume
  }

  setIntensity(value: number) {
    this.intensity = Math.max(0.05, Math.min(0.7, value))
    if (this.context && this.crowdGain) {
      this.crowdGain.gain.setTargetAtTime(this.intensity, this.context.currentTime, 0.6)
    }
  }

  async cue(cue: StadiumCue) {
    const context = await this.ensureContext()
    if (!context || !this.master) return
    const now = context.currentTime

    if (cue === 'whistle' || cue === 'card') {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(cue === 'card' ? 1950 : 2450, now)
      oscillator.frequency.exponentialRampToValueAtTime(2050, now + 0.18)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(cue === 'card' ? 0.12 : 0.2, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (cue === 'card' ? 0.16 : 0.34))
      oscillator.connect(gain).connect(this.master)
      oscillator.start(now)
      oscillator.stop(now + 0.4)
      return
    }

    const source = context.createBufferSource()
    source.buffer = this.noiseBuffer(cue === 'goal' ? 2.4 : 0.5)
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    filter.type = cue === 'kick' || cue === 'tackle' ? 'lowpass' : 'bandpass'
    filter.frequency.value = cue === 'kick' ? 220 : cue === 'goal' ? 980 : 520
    gain.gain.setValueAtTime(cue === 'goal' ? 0.01 : 0.18, now)
    if (cue === 'goal') {
      gain.gain.exponentialRampToValueAtTime(0.8, now + 0.16)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2.35)
      if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(0.7, now, 0.08)
      window.setTimeout(() => {
        if (this.context && this.crowdGain) this.crowdGain.gain.setTargetAtTime(this.intensity, this.context.currentTime, 0.8)
      }, 2800)
    } else {
      gain.gain.setValueAtTime(cue === 'save' ? 0.28 : cue === 'boo' ? 0.22 : 0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + (cue === 'boo' ? 0.7 : 0.4))
    }
    source.connect(filter).connect(gain).connect(this.master)
    source.start(now)
  }

  destroy() {
    this.crowdSource?.stop()
    void this.context?.close()
    this.context = undefined
  }
}

export const stadiumAudio = new StadiumAudioEngine()
