/** Shared VantageFP mark, using the blue/copper artwork in the app navigation. */
export default function VantageLogo({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="VantageFP">
      <svg
        width="38"
        height="38"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13 12L24 35"
          stroke="#3b82f6"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M24 35L35 12"
          stroke="#ea8a2f"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </svg>
      <span aria-hidden="true">
        Vantage<span style={{ color: "var(--v-copper, #c2660c)" }}>FP</span>
      </span>
    </span>
  );
}
