export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  delimiter: "," | ";" = ",",
) {
  const escapeCell = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    let firstVisible = 0;
    while (firstVisible < raw.length && raw.charCodeAt(firstVisible) <= 0x20) {
      firstVisible += 1;
    }
    const firstCharacter = raw[firstVisible];
    const formulaLike =
      typeof value === "string" &&
      (firstCharacter === "=" || firstCharacter === "+" || firstCharacter === "-" || firstCharacter === "@");
    const safe = formulaLike ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(delimiter))
    .join("\r\n");
}
