"use client";

import Typewriter from "typewriter-effect";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EnVisionMark } from "@/components/EnVisionMark";
import { BackgroundMath } from "@/components/BackgroundMath";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function LandingPage() {
	return (
		<div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
			<BackgroundMath />

			{/* Top Bar */}
			<div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-20">
				<div className="flex items-center gap-2.5 text-foreground">
					<EnVisionMark className="w-7 h-7 text-primary-500" />
					<span className="text-[1.1rem] font-bold font-serif tracking-tight">
						EnVision
					</span>
				</div>
				<ThemeToggle />
			</div>

			{/* Main Content */}
			<main className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center text-center mt-12">
				{/* Hero Heading */}
				<h1 className="text-5xl md:text-[4.5rem] font-serif tracking-tight mb-4 leading-[1.12] text-foreground">
					Clarity in every
					<br className="hidden md:block" />
					<span className="text-primary-500"> problem set.</span>
				</h1>

				{/* Editorial subtitle with Typewriter */}
				<div className="sr-only">
					Deconstruct complex Physics problems, Visualize Organic
					Chemistry mechanisms, Map out Calculus derivations,
					Understand Data Structures & Algorithms, Decode advanced
					Circuit Analysis
				</div>
				<div
					aria-hidden="true"
					className="text-lg md:text-xl font-serif text-foreground/60 mb-8 italic h-7 max-w-lg">
					<Typewriter
						options={{
							strings: [
								"Deconstruct complex Physics problems...",
								"Visualize Organic Chemistry mechanisms...",
								"Map out Calculus derivations...",
								"Understand Data Structures & Algorithms...",
								"Decode advanced Circuit Analysis...",
							],
							autoStart: true,
							loop: true,
							delay: 50,
							deleteSpeed: 25,
						}}
					/>
				</div>

				{/* Upload Zone Component */}
				<div className="w-full max-w-xl mx-auto">
					<UploadDropzone />
				</div>
			</main>

			{/* Footer */}
			<footer className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-5 pointer-events-none">
				<div className="w-24 h-px bg-border mb-4" />
				<span className="text-[0.65rem] font-medium tracking-[0.2em] text-foreground/25 uppercase">
					Made with Next.js
				</span>
			</footer>
		</div>
	);
}
