import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site";

/** Logo + pixel wordmark, as in the source's nav. */
export function Brand({ size = 22 }: { size?: number }) {
  return (
    <Link className="brand" href="/" aria-label={`${site.name} home`}>
      <Image src="/logo-128.png" alt="" width={size} height={size} style={{ borderRadius: 6, display: "block" }} />
      <span className="word">{site.name}</span>
    </Link>
  );
}
