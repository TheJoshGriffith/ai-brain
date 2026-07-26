"use client";

import { useState } from "react";

/**
 * `gallery` fence plugin — slideshow for image sets.
 *
 * ```gallery
 * base: https://tibia.fandom.com/wiki/Special:FilePath/
 * Some File Name.png | Optional caption
 * https://example.com/full-url.png | Also works
 * ```
 *
 * Each line is `image | caption`. Bare filenames are resolved against `base`.
 */
interface Slide {
  src: string;
  caption?: string;
}

function parseGallery(code: string): Slide[] {
  let base = "";
  const slides: Slide[] = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const baseMatch = line.match(/^base:\s*(\S+)$/);
    if (baseMatch) {
      base = baseMatch[1];
      continue;
    }
    const [file, ...rest] = line.split("|");
    const name = file.trim();
    if (!name) continue;
    const src = /^https?:\/\//.test(name) ? name : base + encodeURIComponent(name.replace(/ /g, "_"));
    const caption = rest.join("|").trim() || undefined;
    slides.push({ src, caption });
  }
  return slides;
}

function GalleryBlock({ code }: { code: string }) {
  const slides = parseGallery(code);
  const [index, setIndex] = useState(0);
  if (slides.length === 0) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <figure className="gallery-block" style={{ margin: "1rem 0", textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.src}
          alt={slide.caption ?? ""}
          loading="lazy"
          style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 6 }}
        />
        {slides.length > 1 && (
          <>
            <button
              aria-label="Previous image"
              onClick={() => setIndex((index - 1 + slides.length) % slides.length)}
              style={navBtnStyle("left")}
            >
              ‹
            </button>
            <button
              aria-label="Next image"
              onClick={() => setIndex((index + 1) % slides.length)}
              style={navBtnStyle("right")}
            >
              ›
            </button>
          </>
        )}
      </div>
      <figcaption style={{ font: "13px system-ui", opacity: 0.75, marginTop: 6 }}>
        {slide.caption}
        {slides.length > 1 && (
          <span style={{ opacity: 0.6 }}> · {index + 1}/{slides.length}</span>
        )}
      </figcaption>
    </figure>
  );
}

function navBtnStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    [side]: 6,
    top: "50%",
    transform: "translateY(-50%)",
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: 0,
    cursor: "pointer",
    background: "rgba(0,0,0,.55)",
    color: "#fff",
    fontSize: 18,
    lineHeight: "28px",
  };
}

const galleryPlugin = {
  language: "gallery",
  Component: GalleryBlock,
};

export default galleryPlugin;
