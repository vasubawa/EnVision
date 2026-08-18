'use client'

import { useState, useCallback } from 'react'
import { ArrowRight, FileText, UploadCloud, X, Camera } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { createWorkspace } from '@/app/actions/workspace'
import { CameraModal } from './CameraModal'
import { useCaptcha } from '@/components/CaptchaModal'

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const TOAST_IDS = {
  EXTRACT: 'extract-toast',
}

export function UploadDropzone() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const { requireCaptcha } = useCaptcha()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  })

  const router = useRouter()
  const setWorkspaceFile = useWorkspaceStore((state) => state.setFile)

  const handleStartLearning = async (useFile: boolean = true) => {
    if (useFile && !file) return
    setIsUploading(true)

    let token: string | undefined
    try {
      token = await requireCaptcha()
    } catch {
      setIsUploading(false)
      return
    }

    try {
      if (useFile && file) {
        setWorkspaceFile(file)
        toast.success('Extraction complete!', {
          id: TOAST_IDS.EXTRACT,
          description: 'Opening your workspace...',
        })
      } else {
        setWorkspaceFile(null)
      }

      const { data: id, error: createError } = await createWorkspace(token)

      if (createError || !id) {
        throw new Error(createError || 'Failed to create workspace')
      }

      router.push(`/workspace/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace')
      setIsUploading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {!file ? (
        /* Empty state — drop zone */
        <div
          {...getRootProps()}
          className={`animate-fade-in-up group relative flex cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border px-8 py-12 transition-all duration-300 ${
            isDragActive
              ? 'border-primary-500 bg-primary-500/5 scale-[1.01] shadow-sm'
              : 'border-border bg-card/60 dark:bg-card/40 hover:bg-foreground/2 dark:hover:bg-foreground/3 shadow-sm backdrop-blur-sm hover:shadow'
          } `}
        >
          <input {...getInputProps()} />
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
              isDragActive
                ? 'bg-primary-500/15 text-primary-500'
                : 'bg-foreground/5 dark:bg-foreground/8 text-foreground/30 group-hover:bg-primary-500/10 group-hover:text-primary-500'
            } `}
          >
            <UploadCloud className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p
              className={`font-serif text-xl italic transition-colors duration-200 ${isDragActive ? 'text-primary-500' : 'text-foreground/70'}`}
            >
              {isDragActive ? 'Release to drop…' : 'Drop your worksheet here'}
            </p>
            <p className="text-foreground/35 font-sans text-sm">PDF, PNG, JPG or WEBP accepted</p>
          </div>

          {/* Action buttons */}
          {!isDragActive && (
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <button
                id="camera-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCameraOpen(true)
                }}
                className="group border-border bg-card hover:border-primary-500/40 text-foreground/70 hover:text-primary-500 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 sm:w-auto"
                aria-label="Take a photo with camera"
              >
                <Camera className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                Take photo
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStartLearning(false)
                }}
                className="group border-border hover:bg-foreground/5 text-foreground/60 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-5 py-2.5 text-sm font-medium transition-all duration-300 disabled:opacity-50 sm:w-auto"
              >
                Blank Canvas
              </button>
            </div>
          )}
        </div>
      ) : (
        /* File selected state */
        <div className="animate-fade-in-up border-border bg-card/80 dark:bg-card/60 flex flex-col gap-5 rounded-2xl border p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow">
          {/* File info row */}
          <div className="flex items-center gap-4">
            <div className="bg-primary-500/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
              <FileText className="text-primary-500 h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-foreground truncate text-sm font-medium">{file.name}</p>
              <p className="text-foreground/40 mt-0.5 text-xs">
                {formatFileSize(file.size)} · Ready to process
              </p>
            </div>
            <button
              id="clear-file-btn"
              onClick={() => setFile(null)}
              disabled={isUploading}
              className="text-foreground/30 hover:text-foreground hover:bg-foreground/5 shrink-0 rounded-lg p-2 transition-colors disabled:opacity-40"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-border h-px w-full" />

          {/* Action row */}
          <div className="flex items-center justify-between">
            <p className="text-foreground/35 font-serif text-xs italic">
              Ready to extract problems
            </p>
            <button
              id="start-learning-btn"
              onClick={() => handleStartLearning(true)}
              disabled={isUploading}
              className="bg-primary-500 hover:bg-primary-600 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Starting…' : 'Start Learning'}
              {!isUploading && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(capturedFile) => {
          setFile(capturedFile)
          setIsCameraOpen(false)
        }}
      />
    </div>
  )
}
