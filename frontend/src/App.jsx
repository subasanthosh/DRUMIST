import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const instruments = [
  { id: 'kick', name: 'Kick', short: 'K', color: 'kick' },
  { id: 'snare', name: 'Snare', short: 'S', color: 'snare' },
  { id: 'tom', name: 'Tom', short: 'T', color: 'tom' },
  { id: 'overhead', name: 'Overheads', short: 'O', color: 'overhead' },
]

const subdivisions = ['1', 'ta', 'e', 'ta', '&', 'ta', 'a', 'ta']
const barOptions = [1, 2, 4, 8, 16, 32, 64]

function createPattern(stepCount) {
  const pattern = Object.fromEntries(
    instruments.map(({ id }) => [id, Array(stepCount).fill(false)]),
  )

  if (stepCount >= 32) {
    for (const step of [0, 16]) pattern.kick[step] = true
    for (const step of [8, 24]) pattern.snare[step] = true
    for (let step = 0; step < stepCount; step += 8) pattern.overhead[step] = true
    for (let step = 4; step < stepCount; step += 8) pattern.overhead[step] = true
  }

  return pattern
}

function patternFromEvents(events, stepCount, stepDuration) {
  if (!events || Array.isArray(events) || typeof events !== 'object') {
    return { error: 'The event data must be an object keyed by timestamps.' }
  }

  const pattern = Object.fromEntries(
    instruments.map(({ id }) => [id, Array(stepCount).fill(false)]),
  )
  const idByName = new Map([
    ['kick', 'kick'],
    ['snare', 'snare'],
    ['tom', 'tom'],
    ['overhead', 'overhead'],
    ['overheads', 'overhead'],
  ])

  for (const [timestamp, value] of Object.entries(events)) {
    const time = Number(timestamp)
    if (!Number.isFinite(time) || time < 0) {
      return { error: `Invalid timestamp: "${timestamp}".` }
    }
    const step = Math.round(time / stepDuration)
    if (step >= stepCount) {
      return { error: `Timestamp ${timestamp}s is outside the current grid.` }
    }

    for (const name of Array.isArray(value) ? value : [value]) {
      if (typeof name !== 'string') {
        return { error: `Expected a drum name or "Silent" at ${timestamp}s.` }
      }
      if (name.toLowerCase() === 'silent') continue
      const instrumentId = idByName.get(name.toLowerCase())
      if (!instrumentId) {
        return { error: `Unknown drum "${name}" at ${timestamp}s.` }
      }
      pattern[instrumentId][step] = true
    }
  }

  return { pattern }
}

function createAudioKit(context, masterGain) {
  function noiseHit(time, duration, cutoff, volume) {
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    )
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1
    }

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const envelope = context.createGain()
    source.buffer = buffer
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(cutoff, time)
    envelope.gain.setValueAtTime(volume, time)
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(masterGain)
    source.start(time)
  }

  return {
    kick(time) {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(145, time)
      oscillator.frequency.exponentialRampToValueAtTime(43, time + 0.16)
      envelope.gain.setValueAtTime(0.9, time)
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.38)
      oscillator.connect(envelope)
      envelope.connect(masterGain)
      oscillator.start(time)
      oscillator.stop(time + 0.4)
    },
    snare(time) {
      noiseHit(time, 0.2, 1200, 0.55)
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(185, time)
      envelope.gain.setValueAtTime(0.35, time)
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.12)
      oscillator.connect(envelope)
      envelope.connect(masterGain)
      oscillator.start(time)
      oscillator.stop(time + 0.14)
    },
    tom(time) {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(190, time)
      oscillator.frequency.exponentialRampToValueAtTime(72, time + 0.2)
      envelope.gain.setValueAtTime(0.75, time)
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.32)
      oscillator.connect(envelope)
      envelope.connect(masterGain)
      oscillator.start(time)
      oscillator.stop(time + 0.34)
    },
    overhead(time) {
      noiseHit(time, 0.42, 6200, 0.38)
    },
  }
}

function createAudioContext() {
  const context = new window.AudioContext()
  const masterGain = context.createGain()
  masterGain.gain.value = 0.65
  masterGain.connect(context.destination)
  return { context, masterGain, kit: createAudioKit(context, masterGain) }
}

function App() {
  const [numerator, setNumerator] = useState(4)
  const [denominator, setDenominator] = useState(4)
  const [bars, setBars] = useState(1)
  const [bpm, setBpm] = useState(100)
  const [volume, setVolume] = useState(65)
  const [playing, setPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [pattern, setPattern] = useState(() => createPattern(32))
  const [importValue, setImportValue] = useState('')
  const [importError, setImportError] = useState('')
  const [audioError, setAudioError] = useState('')
  const [copied, setCopied] = useState(false)
  const [audioFile, setAudioFile] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [analysisError, setAnalysisError] = useState('')

  const stepCount = numerator * bars * subdivisions.length
  const beatDuration = (60 / bpm) * (4 / denominator)
  const stepDuration = beatDuration / subdivisions.length
  const patternRef = useRef(pattern)
  const stepCountRef = useRef(stepCount)
  const stepDurationRef = useRef(stepDuration)
  const volumeRef = useRef(volume)
  const audioRef = useRef(null)
  const stepIndexRef = useRef(0)
  const nextStepTimeRef = useRef(0)
  const playbackStartTimeRef = useRef(0)
  const scheduledUiTimersRef = useRef([])

  patternRef.current = pattern
  stepCountRef.current = stepCount
  stepDurationRef.current = stepDuration
  volumeRef.current = volume

  useEffect(() => {
    setPattern((previous) =>
      Object.fromEntries(
        instruments.map(({ id }) => [
          id,
          Array.from({ length: stepCount }, (_, index) => previous[id][index] ?? false),
        ]),
      ),
    )
  }, [stepCount])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.masterGain.gain.setTargetAtTime(
        volumeRef.current / 100,
        audioRef.current.context.currentTime,
        0.015,
      )
    }
  }, [volume])

  useEffect(() => {
    if (!playing || !audioRef.current) return undefined

    const { context, kit } = audioRef.current
    const scheduler = window.setInterval(() => {
      const lookAhead = context.currentTime + 0.08
      while (nextStepTimeRef.current < lookAhead) {
        const step = stepIndexRef.current % stepCountRef.current
        for (const instrument of instruments) {
          if (patternRef.current[instrument.id][step]) {
            kit[instrument.id](nextStepTimeRef.current)
          }
        }

        const delay = Math.max(
          0,
          (nextStepTimeRef.current - context.currentTime) * 1000,
        )
        const timer = window.setTimeout(() => setCurrentStep(step), delay)
        scheduledUiTimersRef.current.push(timer)
        nextStepTimeRef.current += stepDurationRef.current
        stepIndexRef.current += 1
      }
    }, 20)

    return () => {
      window.clearInterval(scheduler)
      scheduledUiTimersRef.current.forEach(window.clearTimeout)
      scheduledUiTimersRef.current = []
    }
  }, [playing])

  const patternData = useMemo(() => {
    const events = {}
    for (let step = 0; step < stepCount; step += 1) {
      const hits = instruments
        .filter(({ id }) => pattern[id][step])
        .map(({ name }) => name === 'Overheads' ? 'overhead' : name)
      events[(step * stepDuration).toFixed(4)] =
        hits.length === 0 ? 'Silent' : hits.length === 1 ? hits[0] : hits
    }
    return JSON.stringify(events, null, 2)
  }, [pattern, stepCount, stepDuration])

  function toggleStep(instrumentId, step) {
    setPattern((previous) => ({
      ...previous,
      [instrumentId]: previous[instrumentId].map((active, index) =>
        index === step ? !active : active,
      ),
    }))
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false)
      setCurrentStep(-1)
      return
    }

    setAudioError('')
    try {
      if (!audioRef.current) audioRef.current = createAudioContext()
      audioRef.current.masterGain.gain.setValueAtTime(
        volume / 100,
        audioRef.current.context.currentTime,
      )
      audioRef.current.context.resume().then(() => {
        stepIndexRef.current = 0
        playbackStartTimeRef.current = audioRef.current.context.currentTime + 0.04
        nextStepTimeRef.current = playbackStartTimeRef.current
        setCurrentStep(0)
        setPlaying(true)
      }).catch((error) => {
        console.error('Could not start drum playback:', error)
        setAudioError('Audio could not start. Check your browser audio settings and try again.')
      })
    } catch (error) {
      console.error('Could not initialize drum playback:', error)
      setAudioError('Audio is unavailable in this browser.')
    }
  }

  function clearPattern() {
    setPattern(
      Object.fromEntries(
        instruments.map(({ id }) => [id, Array(stepCount).fill(false)]),
      ),
    )
  }

  function loadDictionary() {
    setImportError('')
    let parsed
    try {
      parsed = JSON.parse(importValue)
    } catch {
      setImportError('Enter a valid JSON object with timestamps as keys.')
      return
    }

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      setImportError('The dictionary must be a JSON object keyed by timestamps.')
      return
    }

    const result = patternFromEvents(parsed, stepCount, stepDuration)
    if (result.error) {
      setImportError(result.error)
      return
    }

    setPattern(result.pattern)
  }

  async function analyzeAudio(event) {
    event.preventDefault()
    if (!audioFile || isAnalyzing) return

    setAnalysisError('')
    setAnalysisMessage('')
    setIsAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('file', audioFile)
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
      const response = await fetch(`${apiBaseUrl}/api/process_audio`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.detail || 'Audio analysis failed. Please try another file.')
      }

      const nextBpm = Number(result.bpm)
      const barDuration = (60 / nextBpm) * (4 / denominator) * numerator
      const requiredBars = Math.max(1, Math.ceil(result.duration / barDuration))
      const nextBars = barOptions.find((value) => value >= requiredBars) ?? 64
      const nextStepCount = numerator * nextBars * subdivisions.length
      const nextStepDuration = (60 / nextBpm) * (4 / denominator) / subdivisions.length
      const mapped = patternFromEvents(result.events, nextStepCount, nextStepDuration)
      if (mapped.error) throw new Error(mapped.error)

      setBpm(nextBpm)
      setBars(nextBars)
      setPattern(mapped.pattern)
      setAnalysisMessage(`Pattern detected at ${nextBpm} BPM · ${result.duration.toFixed(1)} seconds`)
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Audio analysis failed.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function copyPatternData() {
    try {
      await navigator.clipboard.writeText(patternData)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      console.error('Could not copy the drum pattern:', error)
      setImportError('Clipboard access is unavailable. Select and copy the JSON manually.')
    }
  }

  const activeCount = instruments.reduce(
    (total, { id }) => total + pattern[id].filter(Boolean).length,
    0,
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Drumist home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>drumist<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="session-label"><span className="status-dot" /> SESSION 01</span>
          <button className="avatar" type="button" aria-label="Your profile">D</button>
        </div>
      </header>

      <main className="workspace" id="top">
        <section className="intro">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> THE PRACTICE ROOM</div>
            <h1>Build your <span>groove.</span></h1>
            <p className="intro-copy">A drum machine for finding your rhythm, one subdivision at a time.</p>
          </div>
          <div className="meter-card" aria-label={`Time signature ${numerator} over ${denominator}`}>
            <span className="meter-caption">TIME SIGNATURE</span>
            <div className="meter-inputs">
              <select
                aria-label="Time signature numerator"
                value={numerator}
                onChange={(event) => setNumerator(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <span className="meter-divider">/</span>
              <select
                aria-label="Time signature denominator"
                value={denominator}
                onChange={(event) => setDenominator(Number(event.target.value))}
              >
                {[2, 4, 8, 16].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <span className="meter-hint">Shape your measure</span>
          </div>
        </section>

        <section className="transport card">
          <div className="transport-main">
            <button
              className={`play-button${playing ? ' is-playing' : ''}`}
              onClick={togglePlayback}
              type="button"
              aria-label={playing ? 'Stop playback' : 'Play pattern'}
            >
              {playing ? <span className="stop-icon" /> : <span className="play-icon" />}
            </button>
            <div className="transport-copy">
              <span className="transport-title">{playing ? 'Now playing' : 'Ready when you are'}</span>
              <span className="transport-subtitle">{playing ? 'Looping your pattern' : 'Press play to hear your groove'}</span>
            </div>
            <span className={`playing-indicator${playing ? ' active' : ''}`} aria-hidden="true">
              <i /><i /><i /><i /><i />
            </span>
          </div>
          <div className="transport-divider" />
          <label className="tempo-control">
            <span className="control-label">TEMPO</span>
            <span className="tempo-value"><strong>{bpm}</strong><span> BPM</span></span>
            <input
              aria-label="Tempo in beats per minute"
              type="range"
              min="50"
              max="200"
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
          </label>
          <div className="transport-divider" />
          <label className="bars-control">
            <span className="control-label">LENGTH</span>
            <select aria-label="Pattern length in bars" value={bars} onChange={(event) => setBars(Number(event.target.value))}>
              {barOptions.map((value) => <option key={value} value={value}>{value} {value === 1 ? 'bar' : 'bars'}</option>)}
            </select>
          </label>
          <label className="volume-control" title={`Volume ${volume}%`}>
            <span className="control-label">OUTPUT</span>
            <span className="volume-line">
              <span className="volume-icon" aria-hidden="true">◖</span>
              <input
                aria-label="Output volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </span>
          </label>
        </section>

        <section className="analysis-panel card" aria-labelledby="analysis-heading">
          <div className="analysis-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> AUDIO TO PATTERN</div>
            <h2 id="analysis-heading">Start with a recording.</h2>
            <p className="section-caption">Upload a drum recording to detect its tempo and place hits on the grid.</p>
          </div>
          <form className="analysis-form" onSubmit={analyzeAudio}>
            <label className="audio-file-picker">
              <span>{audioFile ? audioFile.name : 'Choose an audio file'}</span>
              <input
                accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
                aria-label="Choose an audio recording"
                type="file"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] ?? null
                  setAnalysisError('')
                  setAnalysisMessage('')
                  if (selectedFile && selectedFile.size > 25 * 1024 * 1024) {
                    setAudioFile(null)
                    setAnalysisError('Audio files must be 25 MB or smaller.')
                    return
                  }
                  setAudioFile(selectedFile)
                }}
              />
            </label>
            <button className="analyze-button" disabled={!audioFile || isAnalyzing} type="submit">
              {isAnalyzing ? 'Analyzing…' : 'Analyze recording'}
            </button>
          </form>
          {(analysisMessage || analysisError) && (
            <p className={`analysis-status${analysisError ? ' error' : ''}`} role={analysisError ? 'alert' : 'status'}>
              {analysisError || analysisMessage}
            </p>
          )}
        </section>

        {audioError && <p className="notice error-notice" role="alert">{audioError}</p>}

        <section className="sequencer card" aria-label="Drum step sequencer">
          <div className="section-heading">
            <div>
              <div className="section-title-line">
                <h2>Step sequencer</h2>
                <span className="live-badge"><span /> {playing ? 'LIVE' : 'STEP GRID'}</span>
              </div>
              <p className="section-caption">Eight subdivisions per beat · click a step to add a hit</p>
            </div>
            <div className="grid-actions">
              <span className="hit-count"><span className="count-dot" /> {activeCount} {activeCount === 1 ? 'hit' : 'hits'}</span>
              <button className="text-button" type="button" onClick={clearPattern}>Clear pattern</button>
            </div>
          </div>

          <div className="grid-legend">
            <span className="legend-spacer">INSTRUMENT</span>
            <div className="ruler-scroll">
              <div className="step-ruler" style={{ gridTemplateColumns: `repeat(${stepCount}, 42px)` }}>
                {Array.from({ length: stepCount }, (_, step) => {
                  const beat = Math.floor(step / subdivisions.length) % numerator
                  const bar = Math.floor(step / (numerator * subdivisions.length))
                  const subdivision = step % subdivisions.length
                  return (
                    <div
                      className={`ruler-step${subdivision === 0 ? ' beat-start' : ''}${step > 0 && step % (numerator * subdivisions.length) === 0 ? ' bar-start' : ''}${currentStep === step ? ' current' : ''}`}
                      key={step}
                    >
                      {subdivision === 0 && (
                        <>
                          {bars > 1 && <span className="bar-number">{bar + 1}.</span>}
                          <span className="beat-number">{beat + 1}</span>
                        </>
                      )}
                      <span className={`subdivision-label${subdivision === 0 ? ' primary-label' : ''}`}>
                        {subdivisions[subdivision]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="sequencer-grid">
            <div className="instrument-list">
              {instruments.map((instrument) => (
                <div className="instrument-row" key={instrument.id}>
                  <span className={`instrument-icon ${instrument.color}`}>{instrument.short}</span>
                  <span className="instrument-name">{instrument.name}</span>
                  <span className="instrument-led" />
                </div>
              ))}
            </div>
            <div className="steps-scroll">
              <div className="step-row" style={{ gridTemplateColumns: `repeat(${stepCount}, 42px)` }}>
                {instruments.flatMap((instrument) =>
                  Array.from({ length: stepCount }, (_, step) => (
                    <button
                      aria-label={`${instrument.name}, step ${step + 1}${pattern[instrument.id][step] ? ', active' : ''}`}
                      aria-pressed={pattern[instrument.id][step]}
                      className={`step-cell ${instrument.color}${pattern[instrument.id][step] ? ' active' : ''}${currentStep === step ? ' playhead' : ''}${step % subdivisions.length === 0 ? ' beat-start' : ''}${step > 0 && step % (numerator * subdivisions.length) === 0 ? ' bar-start' : ''}`}
                      key={`${instrument.id}-${step}`}
                      onClick={() => toggleStep(instrument.id, step)}
                      type="button"
                    />
                  )),
                )}
              </div>
            </div>
          </div>

          <div className="sequencer-footer">
            <span><span className="footer-dot" /> {numerator}/{denominator} · {bars} {bars === 1 ? 'bar' : 'bars'} · {stepCount} steps</span>
            <span className="counting-guide">COUNT IT OUT <strong>1 ta e ta &amp; ta a ta</strong></span>
          </div>
        </section>

        <section className="data-section">
          <div className="data-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> PATTERN DATA</div>
              <h2>Your groove, in time.</h2>
              <p className="section-caption">Timestamped events, ready to use with your Drumist process.</p>
            </div>
            <button className="copy-button" onClick={copyPatternData} type="button">
              <span aria-hidden="true">{copied ? '✓' : '▢'}</span> {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <div className="data-panels">
            <div className="json-panel">
              <div className="panel-topline"><span>OUTPUT</span><span>timestamp → drum</span></div>
              <pre className="json-output">{patternData}</pre>
            </div>
            <div className="import-panel">
              <div className="panel-topline"><span>LOAD A DICTIONARY</span><span>from process.py</span></div>
              <p>Paste timestamped events to map a detected drum part onto the grid.</p>
              <textarea
                aria-label="Paste timestamp dictionary"
                onChange={(event) => {
                  setImportValue(event.target.value)
                  setImportError('')
                }}
                placeholder={'{\n  "0.0000": "Kick",\n  "0.0750": "overhead",\n  "0.1500": "Snare"\n}'}
                value={importValue}
              />
              {importError && <p className="import-error" role="alert">{importError}</p>}
              <button className="load-button" type="button" onClick={loadDictionary}>Load onto grid <span aria-hidden="true">↗</span></button>
            </div>
          </div>
          <p className="data-footnote">Events are spaced at 1/8 of a beat. Layered hits are represented as an array at that timestamp; single hits use the drum name, matching the process output.</p>
        </section>

        <footer className="page-footer">
          <span><span className="footer-brand-mark">d.</span> DRUMIST PRACTICE ROOM</span>
          <span>FIND YOUR POCKET.</span>
        </footer>
      </main>
    </div>
  )
}


export default App

