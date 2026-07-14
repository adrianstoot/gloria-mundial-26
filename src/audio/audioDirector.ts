import type { AudioSettings } from '../features/ui-model'

type InterfaceCue = 'focus' | 'select' | 'back' | 'alert' | 'calendar'

class AudioDirector {
  private context?: AudioContext
  private master?: GainNode
  private music?: GainNode
  private interfaceBus?: GainNode
  private pad: OscillatorNode[] = []
  private settings?: AudioSettings

  async unlock(settings: AudioSettings) {
    this.settings = settings
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.music = this.context.createGain()
      this.interfaceBus = this.context.createGain()
      this.music.connect(this.master)
      this.interfaceBus.connect(this.master)
      this.master.connect(this.context.destination)
      this.startMusic()
    }
    if (this.context.state === 'suspended') await this.context.resume()
    this.apply(settings)
  }

  apply(settings: AudioSettings) {
    this.settings = settings
    if (!this.context || !this.master || !this.music || !this.interfaceBus) return
    const now = this.context.currentTime
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.master / 100, now, .08)
    this.music.gain.setTargetAtTime(settings.music / 100 * .18, now, .12)
    this.interfaceBus.gain.setTargetAtTime(settings.interface / 100 * .34, now, .06)
  }

  private startMusic() {
    if (!this.context || !this.music) return
    const notes = [110, 164.81, 220, 293.66]
    this.pad = notes.map((frequency, index) => {
      const oscillator = this.context!.createOscillator()
      const filter = this.context!.createBiquadFilter()
      const gain = this.context!.createGain()
      oscillator.type = index % 2 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      filter.type = 'lowpass'
      filter.frequency.value = 420 + index * 95
      gain.gain.value = .08 / notes.length
      oscillator.connect(filter).connect(gain).connect(this.music!)
      oscillator.start()
      return oscillator
    })
  }

  cue(cue: InterfaceCue) {
    if (!this.context || !this.interfaceBus || this.settings?.muted) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = cue === 'alert' ? 'square' : 'sine'
    const frequencies: Record<InterfaceCue, number> = { focus: 360, select: 620, back: 240, alert: 860, calendar: 490 }
    oscillator.frequency.setValueAtTime(frequencies[cue], now)
    oscillator.frequency.exponentialRampToValueAtTime(frequencies[cue] * (cue === 'back' ? .72 : 1.18), now + .07)
    gain.gain.setValueAtTime(.0001, now)
    gain.gain.exponentialRampToValueAtTime(cue === 'focus' ? .035 : .09, now + .008)
    gain.gain.exponentialRampToValueAtTime(.0001, now + (cue === 'alert' ? .22 : .11))
    oscillator.connect(gain).connect(this.interfaceBus)
    oscillator.start(now)
    oscillator.stop(now + .25)
  }

}

export const audioDirector = new AudioDirector()
