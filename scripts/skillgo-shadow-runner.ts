import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

async function main() {
  const modulePath = process.env.SKILLGO_RECOMMENDATION_MODULE;
  if (!modulePath) throw new Error("SKILLGO_RECOMMENDATION_MODULE is required.");

  const fixturePath = process.argv[2];
  if (!fixturePath) throw new Error("Fixture path is required.");

  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  const skillgo = await import(pathToFileURL(modulePath).href);
  const result = {
    threshold: skillgo.TREND_DUPLICATE_THRESHOLD,
    similarities: fixtures.similarityCases.map(({ left, right }: { left: string; right: string }) => ({
      normalizedLeft: skillgo.normalizeTopic(left),
      normalizedRight: skillgo.normalizeTopic(right),
      similarity: skillgo.topicSimilarity(left, right),
    })),
    recommendations: fixtures.recommendationCases.map(({ candidates, history }: { candidates: unknown[]; history: unknown[] }) => {
      const recommendation = skillgo.recommendTrendTopic(candidates, history);
      return {
        recommendationId: recommendation.recommendation?.candidate.id ?? null,
        duplicateIds: recommendation.duplicateChecks.map((item: { candidate: { id: string } }) => item.candidate.id),
      };
    }),
  };
  process.stdout.write(JSON.stringify(result));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exitCode = 1;
});
