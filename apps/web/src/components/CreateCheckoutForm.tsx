"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { xrpToDrops } from "@/lib/drops";

export function CreateCheckoutForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    let amountDrops: string;
    try {
      amountDrops = xrpToDrops(String(fd.get("amount") ?? ""));
    } catch {
      setError("Enter a valid positive XRP amount (e.g. 2.5)");
      return;
    }

    const payload = {
      merchantName: String(fd.get("merchantName") ?? "").trim(),
      itemName: String(fd.get("itemName") ?? "").trim(),
      destinationAddress: String(fd.get("destinationAddress") ?? "").trim(),
      memo: String(fd.get("memo") ?? "").trim() || undefined,
      amountDrops,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      const session = (await res.json()) as { id: string };
      router.push(`/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Field label="Merchant name" name="merchantName" placeholder="Demo Cafe" required />
      <Field label="Item" name="itemName" placeholder="Cold brew" required />
      <Field
        label="Amount (XRP)"
        name="amount"
        placeholder="2.5"
        required
        inputMode="decimal"
        pattern="^\d+(\.\d{1,6})?$"
      />
      <Field
        label="Destination XRPL address"
        name="destinationAddress"
        placeholder="rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
        required
        mono
      />
      <Field label="Memo (optional)" name="memo" placeholder="order-1042" />

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex h-14 items-center justify-center rounded-2xl bg-accent px-6 font-bold text-white transition hover:bg-accent-pressed disabled:opacity-50"
      >
        {submitting ? "Creating session…" : "Create checkout"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  inputMode,
  pattern,
  mono,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  mono?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        pattern={pattern}
        className={`rounded-xl border border-border bg-bg px-4 py-3 text-ink outline-none transition placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          mono ? "font-mono text-sm" : ""
        }`}
      />
    </label>
  );
}
