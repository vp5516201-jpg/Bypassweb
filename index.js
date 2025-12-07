const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// Fake Mobile/PC Identities (Taaki Server na lage)
const userAgents = [
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
];

async function bypassLink(url) {
    let browser = null;
    const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    try {
        console.log(`Processing: ${url}`);
        console.log(`Identity: ${randomAgent.substring(0, 50)}...`);

        browser = await puppeteerExtra.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled' // Bot detection chupana
            ],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        
        // Asli User banne ka natak
        await page.setUserAgent(randomAgent);
        
        // Images Block karo (Speed badhane ke liye)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.setDefaultNavigationTimeout(60000); // 60 Sec Timeout
        
        // Link Kholo
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Scroll Logic (View Count ke liye zaroori)
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 2000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // 10 Second Wait (Timer ke liye)
        await new Promise(r => setTimeout(r, 10000));

        const finalUrl = page.url();
        console.log(`Success! Final Link: ${finalUrl}`);
        
        await browser.close();
        return { originalUrl: finalUrl };

    } catch (error) {
        console.error("Error:", error.message);
        if(browser) await browser.close();
        return { error: "Failed to open link. Site might be blocking servers." };
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
