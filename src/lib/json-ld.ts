/**
 * Serialise structured data for a <script type="application/ld+json"> tag.
 *
 * JSON.stringify does not escape "<", so a title or bio containing
 * "</script><script>..." would close the tag early and run attacker-chosen
 * script. Escaping "<" (and the two JS line separators) keeps the output
 * valid JSON while making that impossible.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
