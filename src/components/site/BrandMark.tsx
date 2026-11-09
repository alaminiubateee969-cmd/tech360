/**
 * BrandMark — the TECH360 monogram used in the public header and footer.
 *
 * Renders as inline SVG so it stays crisp at every density, inherits the
 * current text colour for the wordmark, and needs no extra network request.
 * Purely decorative: the surrounding link/wordmark carries the accessible name.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="40" height="40" rx="10" fill="#063B8F" />
      <path
        d="M8 12.5h24M20 12.5V29"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M26.5 20.5v8.5h5.5"
        stroke="#009FE3"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default BrandMark;
