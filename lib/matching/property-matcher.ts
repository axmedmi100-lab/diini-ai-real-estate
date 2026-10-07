export type Requirements = {
  purpose: string | null;
  district: string | null;
  budget_min: number | null;
  budget_max: number | null;
  bedrooms: number | null;
  property_type: string | null;
  furnished: boolean | null;
};

export type MatchableProperty = {
  id: string;
  purpose: string;
  status: string;
  district: string;
  price: number | string;
  bedrooms: number | null;
  property_type: string;
  furnished: boolean | null;
};

const weights = { district: 30, budget: 25, bedrooms: 20, property_type: 15, furnished: 10 } as const;

function sameText(a: string | null, b: string | null) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export function matchProperty(requirements: Requirements, property: MatchableProperty) {
  if (property.status !== "available") return null;
  if (requirements.purpose && property.purpose !== requirements.purpose) return null;

  const checks = [
    { key: "district", label: "Degmada", applicable: Boolean(requirements.district), matched: sameText(requirements.district, property.district), weight: weights.district },
    { key: "budget", label: "Budget", applicable: requirements.budget_min !== null || requirements.budget_max !== null, matched: (requirements.budget_min === null || Number(property.price) >= requirements.budget_min) && (requirements.budget_max === null || Number(property.price) <= requirements.budget_max), weight: weights.budget },
    { key: "bedrooms", label: "Qolalka", applicable: requirements.bedrooms !== null, matched: requirements.bedrooms !== null && property.bedrooms !== null && property.bedrooms >= requirements.bedrooms, weight: weights.bedrooms },
    { key: "property_type", label: "Nooca property-ga", applicable: Boolean(requirements.property_type), matched: sameText(requirements.property_type, property.property_type), weight: weights.property_type },
    { key: "furnished", label: "Furnished", applicable: requirements.furnished !== null, matched: requirements.furnished === property.furnished, weight: weights.furnished },
  ];
  const applicable = checks.filter((check) => check.applicable);
  const possible = applicable.reduce((sum, check) => sum + check.weight, 0);
  const earned = applicable.filter((check) => check.matched).reduce((sum, check) => sum + check.weight, 0);
  return {
    score: possible ? Math.round((earned / possible) * 100) : 100,
    reasons: applicable.map(({ key, label, matched }) => ({ key, label, matched })),
  };
}

export function rankProperties<T extends MatchableProperty>(requirements: Requirements, properties: T[]) {
  return properties.map((property) => {
    const match = matchProperty(requirements, property);
    return match ? { property, ...match } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => b.score - a.score || String(a.property.id).localeCompare(String(b.property.id)));
}
