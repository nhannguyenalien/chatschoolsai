import { recommendTrendTopic, TREND_DUPLICATE_THRESHOLD } from "../domain/trends/recommendation.js";
import { ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

export class RecommendationClaimCompensationError extends Error {
  constructor(cause, cleanupError, claimId) {
    super(`Recommendation failed and claim '${claimId}' could not be released: ${cause.message}`);
    this.name = "RecommendationClaimCompensationError";
    this.cause = cause;
    this.cleanupError = cleanupError;
    this.claimId = claimId;
  }
}

export async function recommendTopic({ repository, legacyHistoryAdapter, tenant, siteId = "", threshold }) {
  if (!tenant) throw new Error("Topic recommendation requires tenant.");
  const site = siteId ? await repository.assertSiteOwned(tenant, siteId) : null;
  const effectiveThreshold = threshold ?? TREND_DUPLICATE_THRESHOLD;
  if (typeof effectiveThreshold !== "number" || !Number.isFinite(effectiveThreshold) || effectiveThreshold < 0 || effectiveThreshold > 1) {
    throw new ContentPlanningValidationError("threshold must be a number between 0 and 1.");
  }
  const legacyHistoryPromise = site && legacyHistoryAdapter?.supports(site)
    ? legacyHistoryAdapter.listHistoricalTopics(site)
    : Promise.resolve([]);
  const [candidatePage, pocketBaseHistory, legacyHistory] = await Promise.all([
    repository.listRecommendationCandidates(tenant, { siteId, status: "imported" }),
    repository.listHistoricalTopics(tenant, siteId),
    legacyHistoryPromise,
  ]);
  const history = [...pocketBaseHistory, ...legacyHistory];
  const historySources = { pocketbase: pocketBaseHistory.length, legacySanity: legacyHistory.length };
  const candidates = (candidatePage.items || []).map((item) => ({
    id: item.id, title: item.title, primaryKeyword: item.primary_keyword, category: item.category,
    rank: item.rank, overallScore: item.overall_score,
  }));
  const result = recommendTrendTopic(candidates, history, effectiveThreshold);
  if (!result.recommendation) return { ...result, historyCount: history.length, historySources, contentionCount: 0 };

  const eligible = result.duplicateChecks.length
    ? candidates.filter((candidate) => !result.duplicateChecks.some((check) => check.candidate.id === candidate.id))
    : candidates;
  let contentionCount = 0;
  for (const candidate of eligible) {
    const selected = recommendTrendTopic([candidate], history, effectiveThreshold).recommendation;
    if (!selected) continue;
    const claim = await repository.tryClaimRecommendation({
      tenant, siteId, topicId: candidate.id, reservationId: crypto.randomUUID(), claimedAt: new Date().toISOString(),
    });
    if (!claim) {
      contentionCount += 1;
      continue;
    }
    try {
      await repository.updateTrendTopic(candidate.id, {
        status: "recommended",
        reservation_id: claim.reservation_id,
        reserved_at: claim.claimed_at,
        duplicate_check_json: JSON.stringify({ closest: selected.closest, threshold: effectiveThreshold }),
      });
    } catch (cause) {
      try {
        await repository.releaseRecommendationClaim(claim.id);
      } catch (cleanupError) {
        throw new RecommendationClaimCompensationError(cause, cleanupError, claim.id);
      }
      throw cause;
    }
    return { ...result, recommendation: selected, claim, historyCount: history.length, historySources, contentionCount };
  }
  return { ...result, recommendation: null, historyCount: history.length, historySources, contentionCount };
}
