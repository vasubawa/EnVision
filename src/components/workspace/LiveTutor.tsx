'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { equivalent } from '@/lib/mathCheck'
import { LIVE_MODELS, LIVE_TOOLS, liveModelLabel } from '@/lib/live/tutorSetup'

type Phase = 'idle' | 'connecting' | 'live' | 'error'

function downsample(input: Float32Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) {
    const out = new Int16Array(input.length)
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]))
      out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return out
  }
  const ratio = fromRate / toRate
  const length = Math.floor(input.length / ratio)
  const out = new Int16Array(length)
  for (let i = 0; i < length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0))
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return out
}

function pcmBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function decodePcm(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Int16Array(bytes.buffer)
}

export function LiveTutor({ workspaceId }: { workspaceId: string }) {
  const learningPreferences = useWorkspaceStore((state) => state.learningPreferences)
  const printedRead = useWorkspaceStore((state) => state.printedRead)
  const lastCanvasUpdate = useWorkspaceStore((state) => state.lastCanvasUpdate)
  const getCanvasImage = useWorkspaceStore((state) => state.getCanvasImage)
  const getInkImage = useWorkspaceStore((state) => state.getInkImage)
  const requestHighlight = useWorkspaceStore((state) => state.requestHighlight)
  const largeText = learningPreferences.largeText

  const [phase, setPhase] = useState<Phase>('idle')
  const [caption, setCaption] = useState('')
  const [voice, setVoice] = useState('Live')
  const [error, setError] = useState<string | null>(null)
  const runRef = useRef(0)
  const sessionRef = useRef<Session | null>(null)
  const playbackRef = useRef<AudioContext | null>(null)
  const nextPlayRef = useRef(0)
  const stopCaptureRef = useRef<(() => void) | null>(null)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])

  const stopPlayback = () => {
    for (const source of sourcesRef.current) {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
    }
    sourcesRef.current = []
    nextPlayRef.current = 0
  }

  const playPcm = async (base64: string) => {
    const playback = playbackRef.current
    if (!playback) return
    const samples = decodePcm(base64)
    const audio = playback.createBuffer(1, samples.length, 24000)
    const channel = audio.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 0x8000
    const source = playback.createBufferSource()
    source.buffer = audio
    source.connect(playback.destination)
    const start = Math.max(playback.currentTime, nextPlayRef.current)
    source.start(start)
    nextPlayRef.current = start + audio.duration
    sourcesRef.current.push(source)
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((item) => item !== source)
    }
  }

  const end = () => {
    runRef.current += 1
    stopCaptureRef.current?.()
    stopCaptureRef.current = null
    stopPlayback()
    sessionRef.current?.close()
    sessionRef.current = null
    void playbackRef.current?.close()
    playbackRef.current = null
    setPhase('idle')
  }

  useEffect(() => {
    return () => {
      stopCaptureRef.current?.()
      stopPlayback()
      sessionRef.current?.close()
      void playbackRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'live') return
    const timeout = window.setTimeout(() => {
      const image = (printedRead?.text && getInkImage ? getInkImage() : getCanvasImage?.()) ?? null
      const data = image?.split(',')[1]
      if (!data || !sessionRef.current) return
      sessionRef.current.sendRealtimeInput({
        video: { data, mimeType: 'image/jpeg' },
      })
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [phase, lastCanvasUpdate, getCanvasImage, getInkImage, printedRead?.text])

  const onMessage = (message: LiveServerMessage) => {
    if (message.serverContent?.interrupted) stopPlayback()
    const spoken = message.serverContent?.outputTranscription?.text
    if (spoken) setCaption(spoken)
    const parts = message.serverContent?.modelTurn?.parts ?? []
    for (const part of parts) {
      const audio = part.inlineData?.data
      if (audio && part.inlineData?.mimeType?.includes('audio')) void playPcm(audio)
    }
    const calls = message.toolCall?.functionCalls ?? []
    if (calls.length === 0 || !sessionRef.current) return
    const responses = calls.map((call) => {
      if (call.name === 'highlight_work') {
        requestHighlight()
        return { id: call.id, name: call.name, response: { highlighted: true } }
      }
      const args = call.args as { left?: string; right?: string } | undefined
      try {
        const match = equivalent(String(args?.left ?? ''), String(args?.right ?? ''))
        return { id: call.id, name: call.name, response: { equivalent: match } }
      } catch (err) {
        return {
          id: call.id,
          name: call.name,
          response: {
            equivalent: null,
            unsupported: err instanceof Error ? err.message : 'Could not check that expression.',
          },
        }
      }
    })
    sessionRef.current.sendToolResponse({ functionResponses: responses })
  }

  const start = async (skip: string[] = []) => {
    const run = runRef.current + 1
    runRef.current = run
    setError(null)
    setPhase('connecting')
    sessionRef.current?.close()
    sessionRef.current = null
    stopCaptureRef.current?.()
    stopCaptureRef.current = null
    let model = ''
    try {
      const tokenRes = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          preferences: learningPreferences,
          problemText: printedRead?.text ?? '',
          skip,
        }),
      })
      const tokenBody = (await tokenRes.json().catch(() => null)) as {
        token?: string
        model?: string
        systemInstruction?: string
        error?: string
      } | null
      if (!tokenRes.ok || !tokenBody?.token || !tokenBody.model || !tokenBody.systemInstruction) {
        throw new Error(tokenBody?.error || 'Live session could not be started.')
      }
      model = tokenBody.model
      setVoice(liveModelLabel(model))

      const playback = new AudioContext()
      playbackRef.current = playback
      await playback.resume()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      const capture = new AudioContext()
      await capture.audioWorklet.addModule('/audio/pcm-capture.js')
      const source = capture.createMediaStreamSource(stream)
      const node = new AudioWorkletNode(capture, 'pcm-capture')
      source.connect(node)
      const mute = capture.createGain()
      mute.gain.value = 0
      node.connect(mute)
      mute.connect(capture.destination)
      stopCaptureRef.current = () => {
        stream.getTracks().forEach((track) => track.stop())
        void capture.close()
      }

      const ai = new GoogleGenAI({
        apiKey: tokenBody.token,
        httpOptions: { apiVersion: 'v1alpha' },
      })
      const session = await ai.live.connect({
        model: tokenBody.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: tokenBody.systemInstruction,
          sessionResumption: {},
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [...LIVE_TOOLS] }],
        },
        callbacks: {
          onmessage: onMessage,
          onerror: () => {
            if (run !== runRef.current) return
            const next = [...skip, model]
            if (model && next.length < LIVE_MODELS.length) {
              void start(next)
              return
            }
            setError('The live connection dropped.')
            setPhase('error')
          },
          onclose: () => {
            if (sessionRef.current) {
              setPhase('idle')
              sessionRef.current = null
            }
          },
        },
      })
      if (run !== runRef.current) {
        session.close()
        return
      }
      sessionRef.current = session
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!sessionRef.current) return
        const pcm = downsample(event.data, capture.sampleRate, 16000)
        sessionRef.current.sendRealtimeInput({
          audio: { data: pcmBase64(pcm), mimeType: 'audio/pcm;rate=16000' },
        })
      }
      setPhase('live')
      setCaption('')
    } catch (err) {
      if (run !== runRef.current) return
      stopCaptureRef.current?.()
      stopCaptureRef.current = null
      sessionRef.current?.close()
      sessionRef.current = null
      const next = model ? [...skip, model] : skip
      if (model && next.length < LIVE_MODELS.length) {
        void start(next)
        return
      }
      void playbackRef.current?.close()
      playbackRef.current = null
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Live session could not be started.')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => (phase === 'live' || phase === 'connecting' ? end() : void start())}
        aria-pressed={phase === 'live'}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${
          phase === 'live'
            ? 'bg-primary-500 text-white'
            : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        {phase === 'live' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">
          {phase === 'connecting' ? 'Connecting' : phase === 'live' ? `End · ${voice}` : 'Talk'}
        </span>
      </button>
      {phase === 'live' && caption ? (
        <p
          className={`text-foreground/80 max-w-56 truncate ${largeText ? 'text-base' : 'text-xs'}`}
        >
          {caption}
        </p>
      ) : null}
      {error ? <p className="max-w-56 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}
