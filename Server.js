require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   🧠 SMC ANALYSIS
========================= */
app.get("/analyze/:pair", async (req, res) => {
  try {
    const pair = req.params.pair.replace("/", "");

    const url = `https://api.twelvedata.com/time_series?symbol=${pair}&interval=15min&outputsize=100&apikey=${process.env.TWELVE_API_KEY}`;
    const response = await axios.get(url);

    const candles = response.data.values;
    if (!candles) return res.json({ error: "No data" });

    // CURRENT PRICE
    const current = parseFloat(candles[0].close);

    // STRUCTURE (trend)
    const past = parseFloat(candles[99].close);
    const bias = current > past ? "BUY" : "SELL";

    // LIQUIDITY ZONES
    const highs = candles.map(c => parseFloat(c.high));
    const lows = candles.map(c => parseFloat(c.low));

    const liquidityHigh = Math.max(...highs);
    const liquidityLow = Math.min(...lows);

    // BREAK OF STRUCTURE (simple)
    const lastHigh = parseFloat(candles[1].high);
    const lastLow = parseFloat(candles[1].low);

    let bos = false;

    if (bias === "BUY" && current > lastHigh) bos = true;
    if (bias === "SELL" && current < lastLow) bos = true;

    // SAFE SCALP TARGET (small profit)
    let entry = current;
    let tp, sl;

    if (bias === "BUY") {
      tp = current + 2; // small safe profit
      sl = current - 1.5;
    } else {
      tp = current - 2;
      sl = current + 1.5;
    }

    // CONFIDENCE
    let confidence = 60;

    if (bos) confidence += 15;
    if (bias === "BUY" && current > liquidityLow) confidence += 10;
    if (bias === "SELL" && current < liquidityHigh) confidence += 10;

    if (confidence > 90) confidence = 90;

    res.json({
      pair,
      bias,
      entry,
      tp,
      sl,
      confidence,
      bos,
      liquidityHigh,
      liquidityLow,
      message: bos
        ? "Break of structure detected — strong move likely"
        : "No BOS — trade carefully"
    });

  } catch (err) {
    res.json({ error: "Analysis failed" });
  }
});

/* ========================= */
app.listen(PORT, () => {
  console.log("Server running...");
});