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

// === CONFIG: FAKE DOMAINS ===
// In domains par bot ko rukna mana hai
const FAKE_DOMAINS = ['wblaxmibhandar', 'tech', 'loan', '1ksfy', 'insurance', 'pmyojana'];

// === PLAN B: API CALL (Jab Bot Fail Ho) ===
async function forceExternalApi(url) {
    console.log("⚠️ Bot Stuck. Forcing External API...");
    try {
        const response = await axios.get(`https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`);
        if (response.data && (response.data.result || response.data.destination)) {
            const final = response.data.result || response.data.destination;
            console.log("✅ API Recovered Link: " + final);
            return final;
        }
    } catch (e) {
        console.log("❌ API Failed.");
    }
    return null;
}

// === FAKE IDENTITIES ===
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
];

async function bypassLink(url) {
    let browser = null;
    let finalDestination = url;

    try {
        console.log(`🚀 Hunting: ${url}`);

        browser = await puppeteerExtra.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled',
                '--disable-popup-blocking'
            ],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

        // Block Heavy Assets (Speed Up)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.setDefaultNavigationTimeout(60000);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // === 3 STEP ATTACK ===
        // Hum loop use karenge taaki redirect pakad sakein
        for (let i = 0; i < 3; i++) {
            console.log(`🔄 Check ${i+1}: ${page.url()}`);
            
            // 1. Scroll Bottom (Button aksar niche hota hai)
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            
            // 2. Wait logic (Agar fake blog hai to 15s wait, nahi to 5s)
            const currentUrl = page.url();
            const isFake = FAKE_DOMAINS.some(d => currentUrl.includes(d));
            await new Promise(r => setTimeout(r, isFake ? 15000 : 5000));

            // 3. Brutal Clicker (Har button daba do)
            try {
                const clicked = await page.evaluate(() => {
                    const keywords = ['get link', 'continue', 'verify', 'open', 'go to link', 'click here', 'scroll down', 'link download'];
                    const buttons = document.querySelectorAll('a, button, div.btn, span.btn, input[type="submit"]');
                    
                    for (let btn of buttons) {
                        const txt = btn.innerText ? btn.innerText.toLowerCase() : "";
                        if (keywords.some(k => txt.includes(k)) && btn.offsetParent !== null) {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                });
                
                if (clicked) {
                    console.log("✅ Clicked! Waiting for redirect...");
                    await new Promise(r => setTimeout(r, 8000));
                }
            } catch(e) {}

            // Update URL
            finalDestination = page.url();
            
            // AGAR SAHI LINK MIL GAYA (Drive, Mega, Mediafire) TO RUK JAO
            if (finalDestination.includes('drive.google') || finalDestination.includes('mega.nz') || finalDestination.includes('mediafire') || finalDestination.includes('youtube')) {
                break;
            }
        }

        await browser.close();

        // === FINAL JUDGMENT (Sabse Zaroori) ===
        // Agar abhi bhi URL me '1ksfy' ya 'blog' hai, matlab FAIL hua hai.
        // Toh hum API use karenge.
        if (FAKE_DOMAINS.some(d => finalDestination.includes(d))) {
            throw new Error("Stuck on Landing Page");
        }

        console.log(`🏁 Success: ${finalDestination}`);
        return { originalUrl: finalDestination };

    } catch (error) {
        console.log(`⚠️ Bot Failed. Using FORCE API.`);
        if(browser) await browser.close();

        // PLAN B: Force API
        const apiLink = await forceExternalApi(url);
        if (apiLink) {
            return { originalUrl: apiLink };
        }

        return { error: "Failed to bypass. Try again." };
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
