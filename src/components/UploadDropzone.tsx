"use client";

import { useState, useCallback } from "react";
import { ArrowRight, FileText, UploadCloud, X, Camera } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { CameraModal } from "./CameraModal";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

function formatFileSize(bytes: number) {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const TOAST_IDS = {
	EXTRACT: "extract-toast",
};

export function UploadDropzone() {
	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isCameraOpen, setIsCameraOpen] = useState(false);

	const onDrop = useCallback((acceptedFiles: File[]) => {
		if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"image/*": [".png", ".jpg", ".jpeg", ".webp"],
			"application/pdf": [".pdf"],
		},
		maxFiles: 1,
	});

	const router = useRouter();
	const setWorkspaceFile = useWorkspaceStore((state) => state.setFile);

	const handleStartLearning = () => {
		if (!file) return;
		setIsUploading(true);
		setTimeout(() => {
			setWorkspaceFile(file);
			toast.success("Extraction complete!", {
				id: TOAST_IDS.EXTRACT,
				description: "Opening your workspace...",
			});
			router.push("/workspace");
			setIsUploading(false);
		}, 1500);
	};

	return (
		<div className="w-full max-w-xl mx-auto">
			{!file ? (
				/* Empty state — drop zone */
				<div
					{...getRootProps()}
					className={`
            animate-fade-in-up
            group relative cursor-pointer rounded-2xl transition-all duration-300
            border
            flex flex-col items-center justify-center gap-5 px-8 py-12
            ${
				isDragActive
					? "border-primary-500 bg-primary-500/5 shadow-sm scale-[1.01]"
					: "border-border bg-card/60 dark:bg-card/40 backdrop-blur-sm hover:bg-foreground/2 dark:hover:bg-foreground/3 shadow-sm hover:shadow"
			}
          `}>
					<input {...getInputProps()} />
					<div
						className={`
            w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
            ${
				isDragActive
					? "bg-primary-500/15 text-primary-500"
					: "bg-foreground/5 dark:bg-foreground/8 text-foreground/30 group-hover:bg-primary-500/10 group-hover:text-primary-500"
			}
          `}>
						<UploadCloud className="w-7 h-7" strokeWidth={1.5} />
					</div>
					<div className="flex flex-col items-center gap-1.5">
						<p
							className={`font-serif italic text-xl transition-colors duration-200 ${isDragActive ? "text-primary-500" : "text-foreground/70"}`}>
							{isDragActive
								? "Release to drop…"
								: "Drop your worksheet here"}
						</p>
						<p className="text-sm text-foreground/35 font-sans">
							PDF, PNG, JPG or WEBP accepted
						</p>
					</div>

					{/* Action buttons */}
					{!isDragActive && (
						<div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
							<button
								id="camera-btn"
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsCameraOpen(true);
								}}
								className="group flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                           border border-border bg-card hover:border-primary-500/40
                           text-foreground/70 hover:text-primary-500
                           transition-all duration-300 shadow-sm hover:shadow-md
                           hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
								aria-label="Take a photo with camera">
								<Camera className="w-4 h-4 transition-transform group-hover:scale-110 duration-300" />
								Take photo
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setWorkspaceFile(null);
									router.push("/workspace");
								}}
								className="group flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                           border border-border bg-transparent hover:bg-foreground/5
                           text-foreground/60 hover:text-foreground
                           transition-all duration-300 w-full sm:w-auto">
								Blank Canvas
							</button>
						</div>
					)}
				</div>
			) : (
				/* File selected state */
				<div
					className="
          animate-fade-in-up
          rounded-2xl border border-border bg-card/80 dark:bg-card/60 backdrop-blur-sm
          shadow-sm hover:shadow transition-shadow
          p-6 flex flex-col gap-5
        ">
					{/* File info row */}
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
							<FileText
								className="w-5 h-5 text-primary-500"
								strokeWidth={1.5}
							/>
						</div>
						<div className="flex-1 min-w-0 text-left">
							<p className="font-medium text-foreground truncate text-sm">
								{file.name}
							</p>
							<p className="text-xs text-foreground/40 mt-0.5">
								{formatFileSize(file.size)} · Ready to process
							</p>
						</div>
						<button
							id="clear-file-btn"
							onClick={() => setFile(null)}
							disabled={isUploading}
							className="p-2 rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40 shrink-0"
							aria-label="Remove file">
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="w-full h-px bg-border" />

					{/* Action row */}
					<div className="flex items-center justify-between">
						<p className="text-xs text-foreground/35 font-serif italic">
							Ready to extract problems
						</p>
						<button
							id="start-learning-btn"
							onClick={handleStartLearning}
							disabled={isUploading}
							className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium
                         bg-primary-500 text-white hover:bg-primary-600
                         transition-colors disabled:opacity-50">
							{isUploading ? "Starting…" : "Start Learning"}
							{!isUploading && <ArrowRight className="w-4 h-4" />}
						</button>
					</div>
				</div>
			)}
			<CameraModal
				isOpen={isCameraOpen}
				onClose={() => setIsCameraOpen(false)}
				onCapture={(capturedFile) => {
					setFile(capturedFile);
					setIsCameraOpen(false);
				}}
			/>
		</div>
	);
}
