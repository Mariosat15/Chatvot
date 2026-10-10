/**
 * Plain-text unit-test report for Copy Report (Badge Simulator pattern).
 * Client-safe — no models, no Node APIs.
 */

export interface UnitTestResultRow {
  name: string;
  suite: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  error?: string;
}

export interface UnitTestRunSummary {
  _id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  testResults?: UnitTestResultRow[];
  errorMessage?: string;
}

export function buildUnitTestReport(run: UnitTestRunSummary): string {
  const results = run.testResults ?? [];
  const failed = results.filter((t) => t.status === "failed");
  const passed = results.filter((t) => t.status === "passed");
  const skipped = results.filter((t) => t.status === "skipped");

  let report = "UNIT TEST REPORT\n";
  report += "════════════════\n";
  report += `Run ID: ${run._id}\n`;
  report += `Started: ${new Date(run.startedAt).toISOString()}\n`;
  if (run.completedAt) {
    report += `Completed: ${new Date(run.completedAt).toISOString()}\n`;
  }
  if (run.duration != null) {
    report += `Duration: ${(run.duration / 1000).toFixed(1)}s\n`;
  }
  report += `Status: ${run.status}\n`;
  report += `Total: ${run.totalTests} | Passed: ${run.passed} | Failed: ${run.failed} | Skipped: ${run.skipped}\n`;
  if (run.errorMessage) {
    report += `\nRunner error:\n${run.errorMessage}\n`;
  }
  report += "\n";

  if (failed.length > 0) {
    report += `FAILURES (${failed.length}):\n─────────────────\n\n`;
    for (const t of failed) {
      report += `[FAILED] ${t.name}\n`;
      report += `  Suite: ${t.suite} | ${t.duration}ms\n`;
      if (t.error) {
        report += `  Error:\n${t.error
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")}\n`;
      }
      report += "\n";
    }
  } else {
    report += "No failures.\n\n";
  }

  if (skipped.length > 0) {
    report += `SKIPPED (${skipped.length}):\n`;
    for (const t of skipped) {
      report += `  - ${t.name} (${t.suite})\n`;
    }
    report += "\n";
  }

  report += `PASSED (${passed.length}):\n`;
  for (const t of passed) {
    report += `  ✓ ${t.name} (${t.suite}, ${t.duration}ms)\n`;
  }

  return report;
}
