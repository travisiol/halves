import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Brand" };

const FILES = [
  { file: "/logo-1024.png", label: "Logo, 1024 px", w: 1024, h: 1024 },
  { file: "/logo-512.png", label: "Logo, 512 px", w: 512, h: 512 },
  { file: "/logo-128.png", label: "Logo, 128 px", w: 128, h: 128 },
  { file: "/banner-1500x500.png", label: "X banner, 1500 × 500", w: 1500, h: 500 },
];

export default function Branding() {
  return (
    <div className="doc">
      <nav>
        <div className="nav-in">
          <Brand size={24} />
          <div className="nav-right" style={{ gap: 22 }}>
            <div className="nav-links">
              <Link href="/docs">Docs</Link>
              <a href={site.x} target="_blank" rel="noopener noreferrer">
                X
              </a>
            </div>
            <Link className="btn acc" href="/app">
              Open the app
            </Link>
          </div>
        </div>
      </nav>
      <header className="doc wrap">
        <h1>Brand kit.</h1>
        <p className="sub">The {site.name} logo and banner, free to use when you write about {site.name}. Please keep them unaltered.</p>
      </header>
      <div className="wrap">
        <section>
          <div className="kvs">
            <div className="kv">
              <span className="k">Name</span>
              <span className="v">{site.name}</span>
            </div>
            <div className="kv">
              <span className="k">X</span>
              <span className="v">{site.xHandle}</span>
            </div>
            <div className="kv">
              <span className="k">Accent</span>
              <span className="v">#3CE3A7</span>
            </div>
            <div className="kv">
              <span className="k">Background</span>
              <span className="v">#0A0C0B</span>
            </div>
            <div className="kv">
              <span className="k">Type</span>
              <span className="v">Archivo · Geist Mono · Silkscreen</span>
            </div>
          </div>
        </section>
        <section>
          <div className="cols" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {FILES.map((f) => (
              <a key={f.file} className="col" href={f.file} download style={{ gridColumn: f.w > f.h ? "1 / -1" : undefined }}>
                <Image src={f.file} alt={f.label} width={f.w} height={f.h} style={{ width: "100%", height: "auto", borderRadius: 10 }} />
                <div className="h" style={{ marginTop: 12 }}>
                  {f.label}
                </div>
                <p>Download PNG</p>
              </a>
            ))}
          </div>
        </section>
      </div>
      <footer>
        <div className="wrap">
          <span>{site.name} · merge is free, always</span>
          <span>
            <Link href="/docs">docs</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
