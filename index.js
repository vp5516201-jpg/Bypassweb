import express from "express";
import cors from "cors";

// Node 18+ me global fetch already available hota hai
const app = express();

app.use(cors());

// Health check (testing ke liye)
app.get("/", (req, res) => {
  res.send("Vyomex Unshortener backend is running ✅");
});

// Main unshort route
app.get("/unshort", async (req, res) => {
  try {
    let url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: "url query param required" });
    }

    // Agar user sirf "bit.ly/xyz" paste kare bina http/https ke
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "http://" + url;
    }

    // Redirect follow – Node 18 ke fetch me redirect: "follow" default hai
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow"
    });

    const finalUrl = response.url;

    if (!finalUrl) {
      return res.status(500).json({ error: "Could not resolve final URL" });
    }

    // Yahan se VIEW tumhare backend pe count hoga,
    // phir hum user ko final site pe bhej denge.
    return res.redirect(finalUrl);

  } catch (err) {
    console.error("Unshort error:", err);
    return res.status(500).json({ error: "Internal error while resolving URL" });
  }
});

// Render / Node env port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vyomex Unshortener running on port ${PORT}`);
});
