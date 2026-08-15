'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X } from 'lucide-react'
import { toast } from 'sonner'

interface CameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    let localStream: MediaStream | null = null

    if (isOpen) {
      setTimeout(() => setError(null), 0)
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((mediaStream) => {
          localStream = mediaStream
          setStream(mediaStream)
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
          }
        })
        .catch((err) => {
          console.debug('getUserMedia error:', err)
          const msg = 'Could not access camera. Please check permissions.'
          setError(msg)
          toast.error(msg, { id: 'camera-error' })
        })
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      setStream(null)
    }
  }, [isOpen])

  const capturePhoto = () => {
    if (!videoRef.current || isCapturing) return
    setIsCapturing(true)

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setIsCapturing(false)
      return
    }

    ctx.drawImage(videoRef.current, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', {
            type: 'image/jpeg',
          })
          onCapture(file)
        }
        setIsCapturing(false)
      },
      'image/jpeg',
      0.9,
    )
  }

  if (!isOpen) return null

  return (
    <div className="bg-background/80 animate-fade-in-up fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-card border-border relative w-full max-w-2xl overflow-hidden rounded-3xl border shadow-[0_16px_64px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_64px_-12px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="border-border/50 bg-card/50 flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <div className="bg-primary-500/10 rounded-xl p-2">
              <Camera className="text-primary-500 h-5 w-5" />
            </div>
            <h3 className="text-foreground font-serif text-lg font-medium tracking-tight">
              Capture Worksheet
            </h3>
          </div>
          <button
            onClick={onClose}
            className="bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground rounded-full p-2.5 transition-all"
            aria-label="Close camera modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden bg-black/5 dark:bg-black/40">
          {error ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <X className="h-6 w-6" />
              </div>
              <p className="font-medium text-red-500">{error}</p>
              <p className="text-foreground/50 text-sm">
                Make sure your browser has permission to access the camera.
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-full w-full scale-[1.02] object-cover"
            />
          )}

          {/* Viewfinder Frame Overlay (Rule of Thirds) */}
          {!error && stream && (
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute top-1/3 left-0 h-px w-full bg-white" />
              <div className="absolute top-2/3 left-0 h-px w-full bg-white" />
              <div className="absolute top-0 left-1/3 h-full w-px bg-white" />
              <div className="absolute top-0 left-2/3 h-full w-px bg-white" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-card border-border/50 flex items-center justify-center border-t p-6">
          <button
            onClick={capturePhoto}
            disabled={!!error || !stream || isCapturing}
            className="group bg-primary-500/10 hover:bg-primary-500/20 relative flex h-20 w-20 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Take photo"
          >
            <div className="bg-primary-500 shadow-primary-500/40 absolute inset-2 rounded-full shadow-lg transition-transform duration-300 group-hover:scale-95" />
            <div className="border-primary-500/30 absolute inset-0 rounded-full border-2 transition-transform duration-500 group-hover:scale-110" />
          </button>
        </div>
      </div>
    </div>
  )
}
