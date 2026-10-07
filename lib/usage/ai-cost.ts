function nonNegativeNumber(value: string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function estimateAiCostUsd(inputTokens: number, outputTokens: number) {
  const inputPerMillion = nonNegativeNumber(process.env.OPENAI_INPUT_COST_PER_1M_USD);
  const outputPerMillion = nonNegativeNumber(process.env.OPENAI_OUTPUT_COST_PER_1M_USD);
  const cost = (Math.max(inputTokens, 0) * inputPerMillion + Math.max(outputTokens, 0) * outputPerMillion) / 1_000_000;
  return Number(cost.toFixed(6));
}
