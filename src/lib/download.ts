/**
 * Triggers a browser download for a Blob. Creates a transient object URL,
 * clicks a synthetic anchor, then revokes the URL on the next tick.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Defer revocation so the download has a chance to start.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
