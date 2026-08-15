export const TREND_DUPLICATE_THRESHOLD = 0.68;

const STOP_WORDS = new Set([
  "a", "an", "and", "cho", "cua", "for", "how", "la", "mot", "nhung", "the", "to",
  "trong", "tu", "va", "ve", "voi", "what", "your",
]);

export function normalizeTopic(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalizeTopic(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

export function topicSimilarity(left, right) {
  const normalizedLeft = normalizeTopic(left);
  const normalizedRight = normalizeTopic(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

export function recommendTrendTopic(candidates, history, threshold = TREND_DUPLICATE_THRESHOLD) {
  const checks = candidates.map((candidate) => {
    const closest = history.reduce((best, item) => {
      const similarity = Math.max(topicSimilarity(candidate.title, item.title), topicSimilarity(candidate.primaryKeyword, item.title));
      return !best || similarity > best.similarity ? { ...item, similarity } : best;
    }, null);
    return { candidate, closest, isDuplicate: Boolean(closest && closest.similarity >= threshold) };
  });
  return {
    recommendation: checks.find((check) => !check.isDuplicate) || null,
    duplicateChecks: checks.filter((check) => check.isDuplicate),
  };
}
