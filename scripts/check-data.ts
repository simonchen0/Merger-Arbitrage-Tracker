// Phase 1 data check: confirms free Yahoo Finance quotes and daily history work.
// Run: npx tsx scripts/check-data.ts
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const symbols = ["AAPL", "MSFT"];

async function main() {
  const quotes = await yf.quote(symbols);
  for (const q of quotes) {
    console.log(
      `${q.symbol}: $${q.regularMarketPrice} as of ${q.regularMarketTime?.toISOString()} (${q.marketState}) - ${q.longName ?? q.shortName}`,
    );
  }

  const from = new Date(Date.now() - 14 * 86400_000);
  const chart = await yf.chart("AAPL", { period1: from, interval: "1d" });
  console.log(`\nAAPL daily closes since ${from.toISOString().slice(0, 10)}:`);
  for (const bar of chart.quotes) {
    console.log(`  ${bar.date.toISOString().slice(0, 10)}  ${bar.close?.toFixed(2)}`);
  }

  // A bad ticker should fail cleanly, not crash.
  const bad = await yf.quote(["NOTAREALTICKERXYZ"]);
  console.log(`\nBad ticker returned ${bad.length} results`);
}

main().catch((err) => {
  console.error("DATA CHECK FAILED:", err.message);
  process.exit(1);
});
