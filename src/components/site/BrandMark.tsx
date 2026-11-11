import Image from "next/image";

/** The approved circular TECH360 logo. The surrounding wordmark names the link. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/tech360-circular-logo.jpg"
      width={1254}
      height={1254}
      alt=""
      aria-hidden="true"
      className={className}
      sizes="64px"
    />
  );
}

export default BrandMark;
