"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildSessionUri } from "@/lib/qr";

export function SessionQR({ sessionId }: { sessionId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [uri, setUri] = useState<string>("");

  useEffect(() => {
    const apiBase =
      typeof window !== "undefined" ? window.location.origin : "";
    const payload = buildSessionUri(sessionId, apiBase);
    setUri(payload);

    let cancelled = false;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 6,
      color: { dark: "#0b0f17", light: "#e6ebf4" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="space-y-2">
      <div className="flex aspect-square items-center justify-center rounded-lg bg-ink p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code encoding ${uri}`}
            className="h-full w-full rounded"
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-border" />
        )}
      </div>
      <div className="truncate text-center font-mono text-[10px] text-subtle" title={uri}>
        {uri || "…"}
      </div>
    </div>
  );
}
