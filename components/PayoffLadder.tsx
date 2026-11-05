import type { DealRow } from "@/lib/dealRow";
import { usd } from "@/lib/format";
import { Badge } from "./Badge";
import { cardClass } from "./ui";

/**
 * The classic merger-arb picture on one bar: what you lose if the deal breaks (break price to
 * today's price, red) against what you make if it closes (today's price to the offer, green).
 * The marker sits at the break-even probability, so the picture and that number always agree.
 */
export function PayoffLadder({ row }: { row: DealRow }) {
  const { deal, price, breakPrice, metrics: m } = row;
  const est = row.breakIsEstimate;

  let body: React.ReactNode;
  if (price === null || breakPrice === null) {
    body = <p className="py-6 text-center text-sm text-muted">Waiting for a market price.</p>;
  } else if (m.breakEven === null || m.downsideDollars === null || m.spreadDollars === null) {
    // Break-even is n/a when the target trades above the offer, or the break price isn't below the price.
    body = (
      <p className="py-6 text-center text-sm text-muted">
        {price > deal.offerPrice
          ? "The target trades above the offer, so the market expects a higher bid. There is no gain to draw at the current terms."
          : "The break price is at or above the current price, so there's no loss to draw. Lower the break price below."}
      </p>
    );
  } else {
    const pos = Math.min(1, Math.max(0, m.breakEven)) * 100; // 0 = break price, 100 = offer
    const loss = Math.abs(m.downsideDollars);

    body = (
      <div
        role="img"
        aria-label={`Payoff ladder. Break price ${usd(breakPrice)}, current price ${usd(price)}, offer ${usd(deal.offerPrice)}. You lose ${usd(loss)} per share if the deal breaks and make ${usd(m.spreadDollars)} per share if it closes.`}
      >
        {/* Current price, above the marker */}
        <div className="relative h-14">
          {/* Centered on the marker, but never closer than 48px to either end of the bar. */}
          <div
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `clamp(48px, ${pos}%, calc(100% - 48px))` }}
          >
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Price now</div>
            <div className="num text-lg font-semibold">{usd(price)}</div>
          </div>
        </div>

        {/* The bar */}
        <div className="relative h-4">
          <div className="flex h-full overflow-hidden rounded-full">
            <div className="bg-down/70" style={{ width: `${pos}%` }} />
            <div className="flex-1 bg-up/70" />
          </div>
          <div
            className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text shadow-[0_0_0_2px_var(--panel)]"
            style={{ left: `${pos}%` }}
          />
        </div>

        {/* Both ends */}
        <div className="mt-4 flex justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              If it breaks {est && <Badge kind="est" title="Uses the estimated break price" />}
            </div>
            <div className={`num text-lg font-semibold ${est ? "text-est" : ""}`}>{usd(breakPrice)}</div>
            <div className="num text-base text-down">−{usd(loss)} / share</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">If it closes</div>
            <div className="num text-lg font-semibold">{usd(deal.offerPrice)}</div>
            <div className="num text-base text-up">+{usd(m.spreadDollars)} / share</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={cardClass("p-5")}>
      <h2 className="text-base font-semibold">Risk and reward</h2>
      {m.breakEven !== null && m.downsideDollars !== null && m.spreadDollars !== null && (
        <p className="mt-1 text-sm text-muted">
          Risk <span className="num text-down">{usd(Math.abs(m.downsideDollars))}</span> to make{" "}
          <span className="num text-up">{usd(m.spreadDollars)}</span> per share
        </p>
      )}
      <div className="mt-3">{body}</div>
    </section>
  );
}
