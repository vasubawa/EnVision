export function EnVisionMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 28 28"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden="true">
			<path
				d="M14 3L25.5 23H2.5L14 3Z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
				fill="none"
				opacity="0.6"
			/>
			<ellipse cx="14" cy="17" rx="3.5" ry="3.5" fill="currentColor" />
			<line
				x1="14"
				y1="3"
				x2="14"
				y2="8"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				opacity="0.4"
			/>
		</svg>
	);
}
