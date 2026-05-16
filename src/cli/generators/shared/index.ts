export function toSingular(name: string) {
  if (!name) return name;
  return name.endsWith("s") ? name.slice(0, -1) : name;
}

export function toPlural(name: string): string {
  if (!name) return name;

  if (name.endsWith("s")) return name;

  return name + "s";
}

export function capitalize(
  value: string
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}