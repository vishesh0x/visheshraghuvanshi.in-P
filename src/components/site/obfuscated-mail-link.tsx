/**
 * Renders a mailto link where every character - in both the visible text
 * and the href - is encoded as an HTML numeric character reference
 * (`&#117;` etc). Browsers decode these automatically while parsing HTML,
 * so real visitors see and click a completely normal-looking, normal-
 * behaving email link with zero JavaScript required.
 *
 * The point is what does NOT happen: the literal substring "user@domain.com"
 * never appears anywhere in the actual HTTP response bytes. Most email
 * harvesters work by regexing raw page source (or even raw SSR/hydration
 * payloads) for an `@`-shaped pattern - encoding every character, not just
 * the `@`, defeats the common shortcut of only special-casing that one
 * character.
 *
 * This can't stop a scraper sophisticated enough to run a full HTML-entity
 * decoder before matching - nothing client-side can, short of requiring a
 * login. It stops the overwhelming majority of bulk address harvesters,
 * which don't bother.
 */
function toEntities(value: string): string {
  return value
    .split("")
    .map((char) => `&#${char.charCodeAt(0)};`)
    .join("");
}

export function ObfuscatedMailLink({
  email,
  className,
  subject,
  label,
  addressClassName,
}: {
  email: string;
  className?: string;
  subject?: string;
  /** Optional caption rendered above the address, inside the same clickable link. */
  label?: string;
  addressClassName?: string;
}) {
  const encodedEmail = toEntities(email);
  const query = subject ? `?subject=${toEntities(subject)}` : "";
  const safeClass = (className ?? "").replace(/"/g, "");
  const safeAddressClass = (addressClassName ?? "").replace(/"/g, "");

  const inner = label
    ? `<p class="label-mono text-muted-foreground">${label}</p><p class="${safeAddressClass}">${encodedEmail}</p>`
    : encodedEmail;

  return (
    <span
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `<a href="mailto:${encodedEmail}${query}" class="${safeClass}">${inner}</a>`,
      }}
    />
  );
}
