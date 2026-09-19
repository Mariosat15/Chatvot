import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Candle1m from "@/database/models/candle-1m.model";
import {
  fetchCandlesForRange,
  getRecentCandles,
  Timeframe,
} from "@/lib/services/forex-historical.service";
import {
  ForexSymbol,
  FOREX_PAIRS,
} from "@/lib/services/pnl-calculator.service";
import { getHistoricalModel } from "@/database/models/candle-historical.model";
import mongoose from "mongoose";

// Get array of forex symbols from FOREX_PAIRS object
const FOREX_SYMBOLS = Object.keys(FOREX_PAIRS) as ForexSymbol[];

interface Gap {
  symbol: string;
  startTime: number;
  endTime: number;
  missingMinutes: number;
}

// Timeframe config for gap filling
const TIMEFRAME_CONFIG: Record<string, { apiTf: Timeframe; minutes: number }> =
  {
    "5m": { apiTf: "5", minutes: 5 },
    "15m": { apiTf: "15", minutes: 15 },
    "30m": { apiTf: "30", minutes: 30 },
    "1h": { apiTf: "60", minutes: 60 },
    "4h": { apiTf: "240", minutes: 240 },
    "1d": { apiTf: "D", minutes: 1440 },
    "1w": { apiTf: "W", minutes: 10080 },
    "1M": { apiTf: "M", minutes: 43200 },
  };

// Reason: Backward-compatible auth — when INTERNAL_API_KEY is configured,
// only requests with a matching x-internal-key header are allowed. When the
// key is not configured the route stays open (admin panel uses its own
// proxy route behind admin JWT for the UI).
function verifyInternalKey(request: NextRequest): NextResponse | null {
  const requiredKey = process.env.INTERNAL_API_KEY;
  if (!requiredKey) return null;
  const provided = request.headers.get("x-internal-key");
  if (provided === requiredKey) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * GET - Detect gaps in candle data
 */
export async function GET(request: NextRequest) {
  const authError = verifyInternalKey(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    const symbol = request.nextUrl.searchParams.get("symbol");
    const symbols = symbol ? [symbol] : FOREX_SYMBOLS.slice(0, 10); // Check top 10 pairs

    const allGaps: Gap[] = [];

    for (const sym of symbols) {
      const candles = await Candle1m.getCandles(sym, 1000);

      if (candles.length < 2) continue;

      // Check for gaps (should be 60 seconds apart)
      for (let i = 1; i < candles.length; i++) {
        const timeDiff = candles[i].time - candles[i - 1].time;

        if (timeDiff > 60) {
          const missingMinutes = Math.floor(timeDiff / 60) - 1;

          // Report ALL gaps - no limit
          allGaps.push({
            symbol: sym,
            startTime: candles[i - 1].time,
            endTime: candles[i].time,
            missingMinutes,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      gaps: allGaps,
      totalGaps: allGaps.length,
      totalMissingMinutes: allGaps.reduce(
        (sum, g) => sum + g.missingMinutes,
        0,
      ),
      symbolsChecked: symbols.length,
    });
  } catch (error) {
    console.error("Error detecting gaps:", error);
    return NextResponse.json(
      { error: "Failed to detect gaps" },
      { status: 500 },
    );
  }
}

/**
 * POST - Fill gaps in candle data from Massive.com API
 * Now fills ALL timeframes: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M
 * Note: Can only fill gaps where Massive.com still has data available
 */
export async function POST(request: NextRequest) {
  const authError = verifyInternalKey(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    const body = await request.json();
    const { symbol, timeframe } = body;

    const symbols = symbol ? [symbol] : FOREX_SYMBOLS.slice(0, 10);
    const timeframesToFill = timeframe
      ? [timeframe]
      : ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

    let totalGapsFilled = 0;
    let totalCandlesFilled = 0;
    const fillResults: Array<{
      symbol: string;
      timeframe: string;
      gapsFilled: number;
      candlesFilled: number;
    }> = [];

    console.log(
      `🔧 [Gap Fill] Starting for ${symbols.length} symbols × ${timeframesToFill.length} timeframes`,
    );

    for (const sym of symbols) {
      // ==========================================
      // FILL 1m GAPS (candles_1m collection)
      // ==========================================
      if (timeframesToFill.includes("1m")) {
        const candles = await Candle1m.getCandles(sym, 1000);

        if (candles.length >= 2) {
          let symbolGapsFilled = 0;
          let symbolCandlesFilled = 0;

          for (let i = 1; i < candles.length; i++) {
            const timeDiff = candles[i].time - candles[i - 1].time;
            const missingMinutes = Math.floor(timeDiff / 60) - 1;

            if (missingMinutes > 0 && missingMinutes < 10000) {
              // Skip huge gaps
              try {
                const gapStartMs = (candles[i - 1].time + 60) * 1000;
                const gapEndMs = (candles[i].time - 60) * 1000;

                const candlesToFill = await fetchCandlesForRange(
                  sym as ForexSymbol,
                  "1" as Timeframe,
                  gapStartMs,
                  gapEndMs,
                );

                for (const candle of candlesToFill) {
                  const existing = await mongoose.connection.db
                    ?.collection("candles_1m")
                    .findOne({
                      symbol: sym,
                      t: Math.floor(candle.time / 1000),
                    });

                  if (!existing) {
                    await Candle1m.upsertCandle(
                      sym,
                      candle.time,
                      candle.open,
                      candle.high,
                      candle.low,
                      candle.close,
                      candle.volume || 0,
                    );
                    symbolCandlesFilled++;
                  }
                }

                if (candlesToFill.length > 0) {
                  symbolGapsFilled++;
                }
              } catch (gapError) {
                console.error("Error filling 1m gap for", sym, gapError);
              }
            }
          }

          if (symbolGapsFilled > 0 || symbolCandlesFilled > 0) {
            fillResults.push({
              symbol: sym,
              timeframe: "1m",
              gapsFilled: symbolGapsFilled,
              candlesFilled: symbolCandlesFilled,
            });
            totalGapsFilled += symbolGapsFilled;
            totalCandlesFilled += symbolCandlesFilled;
            console.log(
              `✅ [Gap Fill] ${sym} 1m: ${symbolCandlesFilled} candles filled`,
            );
          }
        }
      }

      // ==========================================
      // FILL HIGHER TIMEFRAME GAPS (historical collections)
      // ==========================================
      for (const tf of timeframesToFill) {
        if (tf === "1m") continue; // Already handled above

        const config = TIMEFRAME_CONFIG[tf];
        if (!config) continue;

        const historicalModel = getHistoricalModel(tf);
        if (!historicalModel) continue;

        // Get existing candles
        const candles = (await historicalModel
          .find({ symbol: sym })
          .sort({ timestamp: 1 })
          .lean()) as Array<{
          timestamp: Date;
          open: number;
          high: number;
          low: number;
          close: number;
        }>;

        let tfGapsFilled = 0;
        let tfCandlesFilled = 0;

        // If collection is empty or has very few candles, fetch fresh data
        if (candles.length < 50) {
          console.log(
            `📥 [Gap Fill] ${sym} ${tf}: Only ${candles.length} candles, fetching from API...`,
          );

          try {
            const apiCandles = await getRecentCandles(
              sym as ForexSymbol,
              config.apiTf,
              500,
            );

            for (const candle of apiCandles) {
              const timestamp = new Date(candle.time * 1000);
              const day = timestamp.getUTCDay();
              if (day === 0 || day === 6) continue; // Skip weekends

              try {
                // Use $set to OVERWRITE existing incomplete candles
                await historicalModel.updateOne(
                  { symbol: sym, timestamp },
                  {
                    $set: {
                      symbol: sym,
                      timestamp,
                      open: candle.open,
                      high: candle.high,
                      low: candle.low,
                      close: candle.close,
                      volume: candle.volume || 0,
                    },
                  },
                  { upsert: true },
                );
                tfCandlesFilled++;
              } catch {
                /* ignore duplicates */
              }
            }

            tfGapsFilled = 1;
            console.log(
              `✅ [Gap Fill] ${sym} ${tf}: Saved ${tfCandlesFilled} candles from API`,
            );
          } catch (err) {
            console.error("❌ [Gap Fill]", sym, tf, "API fetch failed:", err);
          }
        } else if (candles.length >= 2) {
          // Check for gaps within existing data
          const expectedGapSeconds = config.minutes * 60;

          for (let i = 1; i < candles.length; i++) {
            const prevTime = new Date(candles[i - 1].timestamp).getTime();
            const currTime = new Date(candles[i].timestamp).getTime();
            const timeDiff = (currTime - prevTime) / 1000;

            // Gap larger than 2x expected interval
            if (timeDiff > expectedGapSeconds * 2) {
              const missingMinutes = Math.floor(timeDiff / 60);
              const prevDay = new Date(prevTime).getUTCDay();

              // Skip weekend gaps
              const isWeekendGap =
                (prevDay === 5 || prevDay === 6) &&
                missingMinutes >= 2880 &&
                missingMinutes <= 4500;
              if (isWeekendGap) continue;

              console.log(
                `🔧 [Gap Fill] ${sym} ${tf}: Filling gap ${new Date(prevTime).toISOString()} → ${new Date(currTime).toISOString()}`,
              );

              try {
                const gapCandles = await fetchCandlesForRange(
                  sym as ForexSymbol,
                  config.apiTf,
                  prevTime + config.minutes * 60 * 1000,
                  currTime - config.minutes * 60 * 1000,
                );

                for (const candle of gapCandles) {
                  // fetchCandlesForRange returns time in MILLISECONDS
                  const timestamp = new Date(candle.time);
                  const day = timestamp.getUTCDay();
                  if (day === 0 || day === 6) continue;

                  try {
                    // Use $set to OVERWRITE existing incomplete candles
                    await historicalModel.updateOne(
                      { symbol: sym, timestamp },
                      {
                        $set: {
                          symbol: sym,
                          timestamp,
                          open: candle.open,
                          high: candle.high,
                          low: candle.low,
                          close: candle.close,
                          volume: candle.volume || 0,
                        },
                      },
                      { upsert: true },
                    );
                    tfCandlesFilled++;
                  } catch {
                    /* ignore duplicates */
                  }
                }

                if (gapCandles.length > 0) {
                  tfGapsFilled++;
                }
              } catch (err) {
                console.error("❌ [Gap Fill]", sym, tf, "gap error:", err);
              }
            }
          }

          // Also check for trailing gap (newest candle to now)
          const newestTime = new Date(
            candles[candles.length - 1].timestamp,
          ).getTime();
          const nowTime = Date.now();
          const trailingGapSeconds = (nowTime - newestTime) / 1000;

          if (trailingGapSeconds > expectedGapSeconds * 2) {
            console.log(
              `🔧 [Gap Fill] ${sym} ${tf}: Filling trailing gap from ${new Date(newestTime).toISOString()} to now`,
            );

            try {
              const trailingCandles = await getRecentCandles(
                sym as ForexSymbol,
                config.apiTf,
                100,
              );

              for (const candle of trailingCandles) {
                const candleTimeMs = candle.time * 1000;
                if (candleTimeMs <= newestTime) continue; // Only add newer candles

                const timestamp = new Date(candleTimeMs);
                const day = timestamp.getUTCDay();
                if (day === 0 || day === 6) continue;

                try {
                  // Use $set to OVERWRITE existing incomplete candles
                  await historicalModel.updateOne(
                    { symbol: sym, timestamp },
                    {
                      $set: {
                        symbol: sym,
                        timestamp,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume || 0,
                      },
                    },
                    { upsert: true },
                  );
                  tfCandlesFilled++;
                } catch {
                  /* ignore duplicates */
                }
              }

              if (tfCandlesFilled > 0) {
                tfGapsFilled++;
              }
            } catch (err) {
              console.error(
                "❌ [Gap Fill]", sym, tf, "trailing gap error:", err
              );
            }
          }
        }

        if (tfGapsFilled > 0 || tfCandlesFilled > 0) {
          fillResults.push({
            symbol: sym,
            timeframe: tf,
            gapsFilled: tfGapsFilled,
            candlesFilled: tfCandlesFilled,
          });
          totalGapsFilled += tfGapsFilled;
          totalCandlesFilled += tfCandlesFilled;
          console.log(
            `✅ [Gap Fill] ${sym} ${tf}: ${tfCandlesFilled} candles filled`,
          );
        }
      }
    }

    // Update last run time in settings
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: "market_data_settings" },
        { $set: { "gapFill.lastRun": new Date() } },
      );
    }

    console.log(
      `🔧 [Gap Fill] COMPLETE: ${totalCandlesFilled} candles across ${totalGapsFilled} gaps`,
    );

    return NextResponse.json({
      success: true,
      gapFill: {
        totalGapsFilled,
        totalCandlesFilled,
        symbolsProcessed: symbols.length,
        timeframesProcessed: timeframesToFill,
        results: fillResults,
      },
    });
  } catch (error) {
    console.error("Error filling gaps:", error);
    return NextResponse.json({ error: "Gap fill failed" }, { status: 500 });
  }
}
