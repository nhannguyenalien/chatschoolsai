import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

async function main() {
  const modulePath = process.env.SKILLGO_RECOMMENDATION_MODULE;
  if (!modulePath) throw new Error("SKILLGO_RECOMMENDATION_MODULE is required.");

  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Snapshot path is required.");

  const snapshot = JSON.parse(await readFile(inputPath, "utf8"));
  const skillgo = await import(pathToFileURL(modulePath).href);
  const result = skillgo.recommendTrendTopic(snapshot.candidates, snapshot.history);
  process.stdout.write(JSON.stringify({
    threshold: skillgo.TREND_DUPLICATE_THRESHOLD,
    recommendationId: result.recommendation?.candidate.id ?? null,
    duplicateIds: result.duplicateChecks.map((item: { candidate: { id: string } }) => item.candidate.id),
  }));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exitCode = 1;
});
