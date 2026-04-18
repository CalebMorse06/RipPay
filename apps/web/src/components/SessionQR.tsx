"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildLaunchUrl } from "@/lib/qr";

export function SessionQR({
  sessionId,
  baseUrl,
}: {
  sessionId: string;
  baseUrl?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string>("");

  useEffect(() => {
    const base =
      baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
    const url = buildLaunchUrl(sessionId, base);
    setLaunchUrl(url);

    let cancelled = false;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 6,
      color: { dark: "#0b0f17", light: "#e6ebf4" },
    })
      .then((u) => {
        if (!cancelled) setDataUrl(u);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, baseUrl]);

  return (
    <div className="space-y-2">
      <div className="flex aspect-square items-center justify-center rounded-lg bg-ink p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code encoding ${launchUrl}`}
            className="h-full w-full rounded"
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-border" />
        )}
      </div>
      <a
        href={launchUrl}
        target="_blank"
        rel="noreferrer"
        title={launchUrl}
        className="block truncate text-center font-mono text-[10px] text-subtle hover:text-accent"
      >
        {launchUrl || "…"}
      </a>
    </div>
  );
}
