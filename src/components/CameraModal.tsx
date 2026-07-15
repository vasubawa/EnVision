"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    let localStream: MediaStream | null = null;
    
    if (isOpen) {
      setError(null);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(mediaStream => {
          localStream = mediaStream;
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        })
        .catch((err) => {
          const msg = "Could not access camera. Please check permissions.";
          setError(msg);
          toast.error(msg, { id: "camera-error" });
        });
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
    };
  }, [isOpen]);

  const capturePhoto = () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    // Optional: add a tiny flash effect by flashing state if desired, 
    // but a quick timeout works to avoid multi-clicks
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        onCapture(file);
      }
      setIsCapturing(false);
    }, "image/jpeg", 0.9);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in-up">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl overflow-hidden shadow-[0_16px_64px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_64px_-12px_rgba(0,0,0,0.5)]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-card/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-500/10 rounded-xl">
              <Camera className="w-5 h-5 text-primary-500" />
            </div>
            <h3 className="text-lg font-serif font-medium text-foreground tracking-tight">Capture Worksheet</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-all"
            aria-label="Close camera modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative bg-black/5 dark:bg-black/40 aspect-[4/3] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                <X className="w-6 h-6" />
              </div>
              <p className="text-red-500 font-medium">{error}</p>
              <p className="text-sm text-foreground/50">Make sure your browser has permission to access the camera.</p>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover scale-[1.02]"
            />
          )}
          
          {/* Viewfinder Frame Overlay (Rule of Thirds) */}
          {!error && stream && (
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-1/3 left-0 w-full h-px bg-white" />
              <div className="absolute top-2/3 left-0 w-full h-px bg-white" />
              <div className="absolute top-0 left-1/3 w-px h-full bg-white" />
              <div className="absolute top-0 left-2/3 w-px h-full bg-white" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 flex justify-center items-center bg-card border-t border-border/50">
          <button
            onClick={capturePhoto}
            disabled={!!error || !stream || isCapturing}
            className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-primary-500/10 hover:bg-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Take photo"
          >
            <div className="absolute inset-2 rounded-full bg-primary-500 shadow-lg shadow-primary-500/40 group-hover:scale-95 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-full border-2 border-primary-500/30 group-hover:scale-110 transition-transform duration-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
