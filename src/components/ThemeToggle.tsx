"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			setMounted(true);
		});

		return () => cancelAnimationFrame(frame);
	}, []);

	const toggleTheme = (e: React.MouseEvent) => {
		const nextTheme = theme === "dark" ? "light" : "dark";

		if (!document.startViewTransition) {
			setTheme(nextTheme);
			return;
		}

		const x = e.clientX;
		const y = e.clientY;
		const endRadius = Math.hypot(
			Math.max(x, window.innerWidth - x),
			Math.max(y, window.innerHeight - y),
		);

		const transition = document.startViewTransition(() => {
			flushSync(() => {
				setTheme(nextTheme);
			});
		});

		transition.ready.then(() => {
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${endRadius}px at ${x}px ${y}px)`,
					],
				},
				{
					duration: 600,
					easing: "ease-in-out",
					pseudoElement: "::view-transition-new(root)",
				},
			);
		});
	};

	if (!mounted) {
		return <div className="w-10 h-10" />;
	}

	return (
		<button
			onClick={toggleTheme}
			className="p-2 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
			aria-label="Toggle theme">
			{theme === "dark" ? (
				<Sun className="w-5 h-5" />
			) : (
				<Moon className="w-5 h-5" />
			)}
		</button>
	);
}
