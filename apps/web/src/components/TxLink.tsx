import type { NetworkId } from "@coldtap/shared";

export function TxLink({
  hash,
  network = "testnet",
}: {
  hash: string;
  network?: NetworkId;
}) {
  const href =
    network === "mainnet"
      ? `https://livenet.xrpl.org/transactions/${hash}`
      : network === "testnet"
        ? `https://testnet.xrpl.org/transactions/${hash}`
        : undefined;

  if (!href) {
    return <span className="break-all font-mono text-xs text-subtle">{hash} · mock</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all font-mono text-xs text-accent underline-offset-2 hover:underline"
    >
      {hash}
    </a>
  );
}
