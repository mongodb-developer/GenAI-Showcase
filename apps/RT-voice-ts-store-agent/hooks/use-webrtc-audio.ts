"use client"

import { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"

export interface Tool {
  name: string
  description: string
  parameters?: Record<string, any>
}

interface Conversation {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: string
  isFinal?: boolean
  status?: "speaking" | "processing" | "final"
}

interface UseWebRTCAudioSessionReturn {
  status: string
  isSessionActive: boolean
  audioIndicatorRef: React.RefObject<HTMLDivElement | null>
  startSession: () => Promise<void>
  stopSession: () => void
  handleStartStopClick: () => void
  registerFunction: (name: string, fn: Function) => void
  msgs: any[]
  currentVolume: number
  conversation: Conversation[]
}

export default function useWebRTCAudioSession(voice: string, tools?: Tool[]): UseWebRTCAudioSessionReturn {
  const [status, setStatus] = useState("")
  const [isSessionActive, setIsSessionActive] = useState(false)
  const audioIndicatorRef = useRef<HTMLDivElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [conversation, setConversation] = useState<Conversation[]>([])
  const functionRegistry = useRef<Record<string, Function>>({})
  const [currentVolume, setCurrentVolume] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const volumeIntervalRef = useRef<number | null>(null)
  const ephemeralUserMessageIdRef = useRef<string | null>(null)

  function registerFunction(name: string, fn: Function) {
    functionRegistry.current[name] = fn
  }

  function configureDataChannel(dataChannel: RTCDataChannel) {
    console.log("Configuring data channel")
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        tools: tools || [],
        input_audio_transcription: {
          model: "whisper-1",
        },
      },
    }
    console.log("Sending session update:", sessionUpdate)
    dataChannel.send(JSON.stringify(sessionUpdate))
  }

  function getOrCreateEphemeralUserId(): string {
    let ephemeralId = ephemeralUserMessageIdRef.current
    if (!ephemeralId) {
      ephemeralId = uuidv4()
      ephemeralUserMessageIdRef.current = ephemeralId

      const newMessage: Conversation = {
        id: ephemeralId,
        role: "user",
        text: "",
        timestamp: new Date().toISOString(),
        isFinal: false,
        status: "speaking",
      }

      setConversation((prev) => [...prev, newMessage])
    }
    return ephemeralId
  }

  function updateEphemeralUserMessage(partial: Partial<Conversation>) {
    const ephemeralId = ephemeralUserMessageIdRef.current
    if (!ephemeralId) return

    setConversation((prev) =>
      prev.map((msg) => {
        if (msg.id === ephemeralId) {
          return { ...msg, ...partial }
        }
        return msg
      }),
    )
  }

  function clearEphemeralUserMessage() {
    ephemeralUserMessageIdRef.current = null
  }

  async function handleDataChannelMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data)
      console.log("Received message:", msg)

      switch (msg.type) {
        case "input_audio_buffer.speech_started": {
          console.log("Speech started")
          getOrCreateEphemeralUserId()
          updateEphemeralUserMessage({ status: "speaking" })
          break
        }

        case "input_audio_buffer.speech_stopped": {
          console.log("Speech stopped")
          updateEphemeralUserMessage({ status: "speaking" })
          break
        }

        case "input_audio_buffer.committed": {
          console.log("Audio buffer committed")
          updateEphemeralUserMessage({
            text: "Processing speech...",
            status: "processing",
          })
          break
        }

        case "conversation.item.input_audio_transcription": {
          console.log("Received transcription:", msg.transcript ?? msg.text)
          const partialText = msg.transcript ?? msg.text ?? "User is speaking..."
          updateEphemeralUserMessage({
            text: partialText,
            status: "speaking",
            isFinal: false,
          })
          break
        }

        case "conversation.item.input_audio_transcription.completed": {
          console.log("Transcription completed:", msg.transcript)
          updateEphemeralUserMessage({
            text: msg.transcript || "",
            isFinal: true,
            status: "final",
          })
          clearEphemeralUserMessage()
          break
        }

        case "response.audio_transcript.delta": {
          console.log("Received audio transcript delta:", msg.delta)
          const newMessage: Conversation = {
            id: uuidv4(),
            role: "assistant",
            text: msg.delta,
            timestamp: new Date().toISOString(),
            isFinal: false,
          }

          setConversation((prev) => {
            const lastMsg = prev[prev.length - 1]
            if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
              const updated = [...prev]
              updated[updated.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + msg.delta,
              }
              return updated
            } else {
              return [...prev, newMessage]
            }
          })
          break
        }

        case "response.audio_transcript.done": {
          console.log("Audio transcript completed")
          setConversation((prev) => {
            if (prev.length === 0) return prev
            const updated = [...prev]
            updated[updated.length - 1].isFinal = true
            return updated
          })
          break
        }

        case "response.function_call_arguments.done": {
          console.log("Function call arguments received:", msg.name, msg.arguments)
          const fn = functionRegistry.current[msg.name]
          if (fn) {
            const args = JSON.parse(msg.arguments)
            const result = await fn(args)

            const response = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: msg.call_id,
                output: JSON.stringify(result),
              },
            }
            dataChannelRef.current?.send(JSON.stringify(response))

            const responseCreate = {
              type: "response.create",
            }
            dataChannelRef.current?.send(JSON.stringify(responseCreate))
          }
          break
        }
        default: {
          console.log("Unhandled message type:", msg.type)
          break
        }
      }

      setMsgs((prevMsgs) => [...prevMsgs, msg])
      return msg
    } catch (error) {
      console.error("Error handling data channel message:", error)
    }
  }

  async function getSessionData() {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!response.ok) {
        throw new Error(`Failed to get session data: ${response.status}`)
      }
      const data = await response.json()
      console.log("Session data received:", data)
      return data
    } catch (err) {
      console.error("getSessionData error:", err)
      throw err
    }
  }

  function setupAudioVisualization(stream: MediaStream) {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyzer = audioContext.createAnalyser()
    analyzer.fftSize = 256
    source.connect(analyzer)

    const bufferLength = analyzer.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const updateIndicator = () => {
      if (!audioContext) return
      analyzer.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / bufferLength

      if (audioIndicatorRef.current) {
        audioIndicatorRef.current.classList.toggle("active", average > 30)
      }
      requestAnimationFrame(updateIndicator)
    }
    updateIndicator()

    audioContextRef.current = audioContext
  }

  function getVolume(): number {
    if (!analyserRef.current) return 0
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteTimeDomainData(dataArray)

    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const float = (dataArray[i] - 128) / 128
      sum += float * float
    }
    return Math.sqrt(sum / dataArray.length)
  }

  async function startSession() {
    try {
      setStatus("Requesting microphone access...")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      setupAudioVisualization(stream)

      setStatus("Fetching session data...")
      const sessionData = await getSessionData()

      setStatus("Establishing connection...")
      const pc = new RTCPeerConnection({
        iceServers: sessionData.ice_servers || [],
      })
      peerConnectionRef.current = pc

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", pc.iceConnectionState)
        setStatus(`ICE connection state: ${pc.iceConnectionState}`)
      }

      const audioEl = document.createElement("audio")
      audioEl.autoplay = true

      pc.ontrack = (event) => {
        console.log("Received remote track", event.track.kind)
        audioEl.srcObject = event.streams[0]
        audioEl.play().catch((e) => console.error("Error playing audio:", e))

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const src = audioCtx.createMediaStreamSource(event.streams[0])
        const inboundAnalyzer = audioCtx.createAnalyser()
        inboundAnalyzer.fftSize = 256
        src.connect(inboundAnalyzer)
        analyserRef.current = inboundAnalyzer

        volumeIntervalRef.current = window.setInterval(() => {
          setCurrentVolume(getVolume())
        }, 100)
      }

      pc.addTrack(stream.getTracks()[0], stream)

      const dataChannel = pc.createDataChannel("oai-events")
      dataChannelRef.current = dataChannel

      dataChannel.onopen = () => {
        console.log("Data channel opened")
        setStatus("Data channel opened")
        configureDataChannel(dataChannel)
      }
      dataChannel.onmessage = handleDataChannelMessage

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const baseUrl = "https://api.openai.com/v1/realtime"
      const model = "gpt-4o-realtime-preview-2024-12-17"
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${sessionData.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
      })

      if (!sdpResponse.ok) {
        throw new Error(`Failed to send offer: ${sdpResponse.status}`)
      }

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      }
      await pc.setRemoteDescription(answer)

      setIsSessionActive(true)
      setStatus("Session established successfully!")
    } catch (err) {
      console.error("startSession error:", err)
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
      stopSession()
    }
  }

  function stopSession() {
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
    if (audioIndicatorRef.current) {
      audioIndicatorRef.current.classList.remove("active")
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current)
      volumeIntervalRef.current = null
    }
    analyserRef.current = null

    ephemeralUserMessageIdRef.current = null

    setCurrentVolume(0)
    setIsSessionActive(false)
    setStatus("Session stopped")
    setMsgs([])
    setConversation([])
  }

  function handleStartStopClick() {
    if (isSessionActive) {
      stopSession()
    } else {
      startSession()
    }
  }

  useEffect(() => {
    return () => stopSession()
  }, [])

  return {
    status,
    isSessionActive,
    audioIndicatorRef,
    startSession,
    stopSession,
    handleStartStopClick,
    registerFunction,
    msgs,
    currentVolume,
    conversation,
  }
}

