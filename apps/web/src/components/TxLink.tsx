import type { NetworkId } from "@coldtap/shared";

export function TxLink({
  hash,
  network = "testnet",
}: {
  hash: string;
  network?: NetworkId;
}) {
  const host =
    network === "mainnet"
      ? "livenet.xrpl.org"
      : network === "devnet"
        ? "devnet.xrpl.org"
        : network === "testnet"
          ? "testnet.xrpl.org"
          : undefined;

  if (!host) {
    return <span className="break-all font-mono text-xs text-subtle">{hash} · mock</span>;
  }
  return (
    <a
      href={`https://${host}/transactions/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="group block"
    >
      <span className="block break-all font-mono text-xs text-ink group-hover:text-accent">{hash}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent opacity-80 group-hover:opacity-100">
        View on XRPL Explorer
        <span aria-hidden>→</span>
      </span>
    </a>
  );
}
