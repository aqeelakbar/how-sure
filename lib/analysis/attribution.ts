export type AttributionParse = {
  original: string;
  attribution: string | null;
  proposition: string;
  detected: boolean;
};

function cleanProposition(value: string) {
  return value.trim().replace(/^["“]|["”]$/g, "").trim();
}

function looksLikeAttributionLabel(value: string) {
  const label = value.trim();

  if (!label || label.length > 80) return false;
  if (/[0-9]/.test(label)) return false;

  const words = label.split(/\s+/);
  if (words.length > 8) return false;

  // Conservative rule for bare "Name: claim" input:
  // - title-cased person/source names: "Kemi Badenoch", "BBC News"
  // - acronyms: "ONS", "WHO"
  //
  // This deliberately rejects topic labels such as:
  // "UK inflation: 3.2%" or "NHS waiting lists: 7.4 million".
  return words.every((word) => {
    const stripped = word.replace(/[.'’()-]/g, "");
    return (
      /^[A-Z][a-z]+$/.test(stripped) ||
      /^[A-Z]{2,}$/.test(stripped)
    );
  });
}

/**
 * Separates an explicit reporting wrapper from the proposition.
 *
 * Examples:
 * "Kemi Badenoch says claiming benefits is too easy"
 * -> attribution: "Kemi Badenoch"
 * -> proposition: "claiming benefits is too easy"
 *
 * "Kemi Badenoch: claiming benefits is too easy"
 * -> attribution: "Kemi Badenoch"
 * -> proposition: "claiming benefits is too easy"
 *
 * "Kemi Badenoch misled Parliament"
 * -> no attribution wrapper detected
 *
 * "UK inflation: 3.2%"
 * -> no attribution wrapper detected
 */
export function parseAttribution(statement: string): AttributionParse {
  const original = statement.trim().replace(/\s+/g, " ");

  const reportingVerb =
    original.match(
      /^(.{2,80}?)\s+(?:says|said|claims|claimed|asserts|asserted|argues|argued|states|stated|believes|believed|insists|insisted|suggests|suggested)\s+(?:that\s+)?(.+)$/i
    );

  if (reportingVerb) {
    const attribution = reportingVerb[1]?.trim();
    const proposition = cleanProposition(reportingVerb[2] ?? "");

    if (attribution && proposition && attribution.split(/\s+/).length <= 10) {
      return {
        original,
        attribution,
        proposition,
        detected: true,
      };
    }
  }

  const accordingTo =
    original.match(/^according to\s+(.{2,80}?)[,:]\s*(.+)$/i);

  if (accordingTo) {
    const attribution = accordingTo[1]?.trim();
    const proposition = cleanProposition(accordingTo[2] ?? "");

    if (attribution && proposition) {
      return {
        original,
        attribution,
        proposition,
        detected: true,
      };
    }
  }

  const colonWrapper = original.match(/^(.{2,80}?):\s*["“]?(.+?)["”]?$/);

  if (colonWrapper) {
    const attribution = colonWrapper[1]?.trim();
    const proposition = cleanProposition(colonWrapper[2] ?? "");

    if (
      attribution &&
      proposition &&
      looksLikeAttributionLabel(attribution)
    ) {
      return {
        original,
        attribution,
        proposition,
        detected: true,
      };
    }
  }

  return {
    original,
    attribution: null,
    proposition: original,
    detected: false,
  };
}
