const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cors = require('cors');

const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// === PLAN B: EXTERNAL API BYPASSER (Jab Bot Fail Ho Jaye) ===
// Ye function tab chalega jab Key Generate karni ho
async function useExternalApi(url) {
    try {
        console.log("⚠️ Bot stuck. Switching to External API for Key...");
        // Hum ek free public API use kar rahe hain jo keys tod sakti hai
        // Note: Ye APIs badalti rehti hain, abhi Ethos/Bypass.vip use kar rahe hain
        const apiUrl = `https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl);
        
        if (response.data && response.data.result) {
            console.log("✅ API Success: " + response.data.result);
            return response.data.result;
        } else if (response.data && response.data.destination) {
             console.log("✅ API Success: " + response.data.destination);
             return response.data.destination;
        }
        return null;
    } catch (error) {
        console.log("❌ External API also failed.");
        return null;
    }
}

// === PLAN A: HUMARA BOT (View Count Ke Liye) ===
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
];

async function bypassLink(url) {
    let browser = null;
    try {
        console.log(`🚀 Plan A: Starting Hunt for ${url}`);
        
        browser = await puppeteerExtra.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled'
            ],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomAgent);

        // Heavy files block karo
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.setDefaultNavigationTimeout(30000); // 30 sec limit for Plan A
        
        // Try Loading
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Scroll (View Count Logic)
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 1000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // 10 Second Wait for Button/Timer
        await new Promise(r => setTimeout(r, 10000));

        // CLICKER LOGIC (Simple pages ke liye)
        try {
            const clicked = await page.evaluate(() => {
                const keywords = ['get link', 'continue', 'verify', 'go to link'];
                const elements = document.querySelectorAll('a, button, div.btn');
                for (let el of elements) {
                    const text = el.innerText ? el.innerText.toLowerCase() : "";
                    if (keywords.some(key => text.includes(key))) {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            if(clicked) await new Promise(r => setTimeout(r, 5000));
        } catch(e) {}

        const finalUrl = page.url();

        // CHECK: Agar URL wahi purana hai (Matlab Key par atak gaya)
        if (finalUrl.includes(url) || finalUrl.includes('1ksfy') || finalUrl.includes('linkvertise')) {
            throw new Error("Stuck on Key Page"); // Force Error to trigger Plan B
        }

        console.log(`🏁 Plan A Success: ${finalUrl}`);
        await browser.close();
        return { originalUrl: finalUrl };

    } catch (error) {
        console.log(`⚠️ Plan A Failed (${error.message}). Switching to Plan B...`);
        if(browser) await browser.close();

        // CALL EXTERNAL API (Plan B)
        const apiResult = await useExternalApi(url);
        
        if (apiResult) {
            return { originalUrl: apiResult };
        } else {
            return { error: "Failed to bypass. Key system is too strong." };
        }
    }
}

app.get('/api/bypass', async (req, res) => {
    const url = req.query.url;
    if(!url) return res.json({ error: "No URL" });
    const result = await bypassLink(url);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
