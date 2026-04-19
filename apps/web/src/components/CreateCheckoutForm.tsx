"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { xrpToDrops } from "@/lib/drops";

type Currency = "USD" | "XRP";

const DEMO_PRESET = {
  merchantName: "Demo Cafe",
  itemName: "Cold brew",
  amount: "3.50",
  destinationAddress: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  memo: "",
};

const USD_REGEX = /^\d+(\.\d{1,2})?$/;
const XRP_REGEX = /^\d+(\.\d{1,6})?$/;

export function CreateCheckoutForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [values, setValues] = useState({
    merchantName: "",
    itemName: "",
    amount: "",
    destinationAddress: "",
    memo: "",
  });

  function fillDemo() {
    setValues({ ...DEMO_PRESET });
    setCurrency("USD");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  }

  function switchCurrency(next: Currency) {
    if (next === currency) return;
    setCurrency(next);
    // Clear the amount when switching units so "3.50" doesn't silently jump
    // from $3.50 to 3.50 XRP. The vendor re-enters in the new unit.
    setValues((v) => ({ ...v, amount: "" }));
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const amount = values.amount.trim();
    const regex = currency === "USD" ? USD_REGEX : XRP_REGEX;
    if (!regex.test(amount) || Number(amount) <= 0) {
      setError(
        currency === "USD"
          ? "Enter a valid positive USD amount (e.g. 3.50)"
          : "Enter a valid positive XRP amount (e.g. 2.5)",
      );
      return;
    }

    const base = {
      merchantName: values.merchantName.trim(),
      itemName: values.itemName.trim(),
      destinationAddress: values.destinationAddress.trim(),
      memo: values.memo.trim() || undefined,
    };
    let payload: Record<string, unknown>;
    if (currency === "USD") {
      payload = { ...base, fiatAmount: amount, fiatCurrency: "USD" };
    } else {
      let amountDrops: string;
      try {
        amountDrops = xrpToDrops(amount);
      } catch {
        setError("Enter a valid positive XRP amount (e.g. 2.5)");
        return;
      }
      payload = { ...base, amountDrops };
    }

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
      <Field
        label="Merchant name"
        name="merchantName"
        placeholder="Demo Cafe"
        required
        value={values.merchantName}
        onChange={handleChange}
      />
      <Field
        label="Item"
        name="itemName"
        placeholder="Cold brew"
        required
        value={values.itemName}
        onChange={handleChange}
      />

      <label className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Amount ({currency})
          </span>
          <CurrencyToggle value={currency} onChange={switchCurrency} />
        </div>
        <input
          name="amount"
          placeholder={currency === "USD" ? "3.50" : "1.00"}
          required
          inputMode="decimal"
          pattern={currency === "USD" ? "^\\d+(\\.\\d{1,2})?$" : "^\\d+(\\.\\d{1,6})?$"}
          value={values.amount}
          onChange={handleChange}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-ink outline-none transition placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>

      <Field
        label="Destination XRPL address"
        name="destinationAddress"
        placeholder="rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
        required
        mono
        value={values.destinationAddress}
        onChange={handleChange}
      />
      <Field
        label="Memo (optional)"
        name="memo"
        placeholder="order-1042"
        value={values.memo}
        onChange={handleChange}
      />

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 inline-flex h-14 items-center justify-center rounded-2xl bg-accent px-6 font-bold text-white transition hover:bg-accent-pressed disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create checkout"}
        </button>
        <button
          type="button"
          onClick={fillDemo}
          className="h-14 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-subtle transition hover:border-accent hover:text-accent"
          title="Fill demo values"
        >
          Demo
        </button>
      </div>
    </form>
  );
}

function CurrencyToggle({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (next: Currency) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-[11px] font-semibold">
      {(["USD", "XRP"] as const).map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`rounded-full px-3 py-1 transition ${
              active
                ? "bg-accent text-white"
                : "text-subtle hover:text-ink"
            }`}
            aria-pressed={active}
          >
            {c}
          </button>
        );
      })}
    </div>
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
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  mono?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
        {label}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        pattern={pattern}
        value={value}
        onChange={onChange}
        className={`rounded-xl border border-border bg-bg px-4 py-3 text-ink outline-none transition placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          mono ? "font-mono text-sm" : ""
        }`}
      />
    </label>
  );
}
