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

// === CONFIGURATION ===
// Ye wo sites hain jahan bot ko rukna nahi hai (Fake Destinations)
const INTERMEDIATE_DOMAINS = [
    'wblaxmibhandar.com', 
    'tech', 
    'loan', 
    'insurance', 
    'lyrics', 
    'recipe',
    'pmyojana'
];

async function useExternalApi(url) {
    try {
        console.log("⚠️ Bot Stuck. Calling External API...");
        const response = await axios.get(`https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`);
        if (response.data && (response.data.result || response.data.destination)) {
            return response.data.result || response.data.destination;
        }
    } catch (e) {}
    return null;
}

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
];

async function bypassLink(url) {
    let browser = null;
    
    try {
        console.log(`🚀 Starting Multi-Step Hunt for: ${url}`);

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

        // Speed Boost: Images Block
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.setDefaultNavigationTimeout(60000);
        
        // Loop shuru (Maximum 3 hops allow karenge)
        let currentUrl = url;
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        for(let step = 1; step <= 3; step++) {
            console.log(`🔄 Step ${step}: Currently at ${page.url()}`);

            // 1. Scroll (Pura niche tak, kyunki button aksar footer me hota hai)
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });

            // 2. Wait (Blog page par timer hota hai 15s ka)
            // Agar pehla step hai to kam wait, agar blog hai to zyada wait
            const waitTime = (page.url().includes('wblaxmibhandar')) ? 15000 : 8000;
            await new Promise(r => setTimeout(r, waitTime));

            // 3. Click Logic (Aggressive)
            try {
                const clicked = await page.evaluate(() => {
                    // Ye text dhundo button par
                    const keywords = ['get link', 'click to continue', 'click here', 'verify', 'scroll down', 'go to link', 'link download', 'open link'];
                    const elements = document.querySelectorAll('a, button, div.btn, span, input[type="submit"]');
                    
                    for (let el of elements) {
                        const text = el.innerText ? el.innerText.toLowerCase() : "";
                        // Agar keyword mile aur element visible ho
                        if (keywords.some(k => text.includes(k)) && el.offsetParent !== null) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });

                if(clicked) {
                    console.log("✅ Button Clicked! Waiting for next page...");
                    await new Promise(r => setTimeout(r, 8000)); // Click ke baad wait
                }
            } catch(e) {}

            const newUrl = page.url();

            // CHECK: Kya hume rukna chahiye?
            // Agar URL change nahi hua, ya abhi bhi 'Fake Blog' par hai
            const isFakeBlog = INTERMEDIATE_DOMAINS.some(d => newUrl.includes(d));
            
            if (!isFakeBlog && newUrl !== currentUrl && !newUrl.includes('1ksfy')) {
                console.log("🎉 Destination Reached!");
                currentUrl = newUrl;
                break; // Loop todo, manzil mil gayi
            }
            
            // Agar URL same hai, matlab atak gaya
            if (newUrl === currentUrl && step > 1) {
                console.log("⚠️ Stuck on same page.");
                break;
            }
            
            currentUrl = newUrl;
        }

        console.log(`🏁 Final Link: ${currentUrl}`);
        
        // Final Check: Agar abhi bhi Blog link hai, to Plan B use karo
        if (currentUrl.includes('wblaxmibhandar') || currentUrl.includes('1ksfy')) {
            throw new Error("Still on landing page");
        }

        await browser.close();
        return { originalUrl: currentUrl };

    } catch (error) {
        console.log(`❌ Bot Failed: ${error.message}. Trying External API...`);
        if(browser) await browser.close();

        // Plan B: API
        const apiResult = await useExternalApi(url);
        if (apiResult) return { originalUrl: apiResult };

        return { error: "Failed to bypass." };
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
