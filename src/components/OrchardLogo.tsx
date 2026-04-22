// Canonical Orchard sprout mark — used in sidebar, login, and register pages.
// Circle background in forest green (#2D4A2D) with a white seedling inside:
// a central stem and two symmetrical leaves curving outward and upward.

export function OrchardLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Circle background */}
      <circle cx="16" cy="16" r="16" fill="#2D4A2D" />

      {/* Stem */}
      <path d="M16 25L16 13" stroke="white" strokeWidth="2" strokeLinecap="round" />

      {/* Left leaf — curves from stem junction outward-left to tip, back to stem */}
      <path d="M16 19C12 18 8 13 10 9C12 5 16 14 16 19Z" fill="white" />

      {/* Right leaf — mirror of left */}
      <path d="M16 19C20 18 24 13 22 9C20 5 16 14 16 19Z" fill="white" />
    </svg>
  );
}
