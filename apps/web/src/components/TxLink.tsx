export function TxLink({ hash }: { hash: string }) {
  const href = `https://testnet.xrpl.org/transactions/${hash}`;
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
