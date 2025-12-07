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

// === 1. DOMAIN CONFIGURATION (Tumhari List Ke Hisab Se) ===
// Humne Links ko category mein baant diya hai
const siteConfigs = {
    // HARD LINKS (Ads + Timer + Button)
    'shrinkearn': { wait: 15000, btn: ['verify', 'continue', 'get link'], adBlock: true },
    'linkpays':   { wait: 15000, btn: ['get link', 'continue'], adBlock: true },
    'zipzy':      { wait: 12000, btn: ['get link', 'go'], adBlock: true },
    'surl.li':    { wait: 5000, btn: ['go'], adBlock: false },
    
    // MEDIUM LINKS (Thoda wait)
    'linkly':     { wait: 5000, btn: null, adBlock: false },
    'rebrandly':  { wait: 3000, btn: null, adBlock: false },
    'sniply':     { wait: 5000, btn: ['continue'], adBlock: true },

    // DEFAULT (Bitly, TinyURL, etc. ke liye auto-detect)
    'default':    { wait: 4000, btn: ['get link', 'continue', 'skip ad', 'go'], adBlock: false }
};

// Domain Pehchanne ka Function
function getConfig(url) {
    for (const key in siteConfigs) {
        if (url.toLowerCase().includes(key)) return siteConfigs[key];
    }
    return siteConfigs['default'];
}

// === 2. GOOGLE ADS BLOCKER LIST ===
// Ye domains load hi nahi honge taaki bot confuse na ho
const blockedDomains = [
    'googlesyndication.com', 'adservice.google.com', 'doubleclick.net',
    'google-analytics.com', 'facebook.net', 'adnxs.com', 'popads.net',
    'push', 'notification', 'tracker'
];

// === 3. PLAN B: EXTERNAL API ===
async function useExternalApi(url) {
    try {
        console.log("⚠️ Switching to External API...");
        const response = await axios.get(`https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`);
        if (response.data && (response.data.result || response.data.destination)) {
            return response.data.result || response.data.destination;
        }
    } catch (e) { console.log("Plan B Failed."); }
    return null;
}

// === 4. PLAN A: MAIN LOGIC ===
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
];

async function bypassLink(url) {
    let browser = null;
    const config = getConfig(url);
    
    try {
        console.log(`🚀 Processing: ${url}`);
        
        browser = await puppeteerExtra.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled',
                '--disable-popup-blocking' // Popups handle karne ke liye
            ],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

        // === AD BLOCKER SYSTEM ===
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const reqUrl = req.url();
            const resourceType = req.resourceType();

            // Agar Heavy Link hai (Linkpays etc) to Images aur Ads block karo
            if (config.adBlock || blockedDomains.some(d => reqUrl.includes(d))) {
                if (['image', 'media', 'font', 'stylesheet', 'other'].includes(resourceType) || blockedDomains.some(d => reqUrl.includes(d))) {
                    req.abort();
                    return;
                }
            }
            req.continue();
        });

        page.setDefaultNavigationTimeout(60000);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Scroll (View Count ke liye)
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

        // Config ke hisab se Wait karo
        await new Promise(r => setTimeout(r, config.wait));

        // === SMART CLICKER ===
        // Agar simple redirect nahi hua, to button dabao
        if (config.btn) {
            try {
                const clicked = await page.evaluate((btnList) => {
                    // Button Keywords dhundo (Verify, Get Link etc)
                    const elements = document.querySelectorAll('a, button, input[type="submit"], div.btn');
                    for (let el of elements) {
                        const text = el.innerText ? el.innerText.toLowerCase() : "";
                        const val = el.value ? el.value.toLowerCase() : "";
                        
                        if (btnList.some(k => text.includes(k) || val.includes(k))) {
                            // Check visibility
                            if(el.offsetParent !== null) {
                                el.click();
                                return true;
                            }
                        }
                    }
                    return false;
                }, config.btn);

                if (clicked) {
                    console.log("✅ Button Clicked! Waiting...");
                    await new Promise(r => setTimeout(r, 6000));
                }
            } catch(e) {}
        }

        const finalUrl = page.url();

        // Check if stuck (URL same hai ya shortener domain par hi hai)
        if (finalUrl.includes(url) || finalUrl.length < 15) {
             throw new Error("Stuck on page");
        }

        console.log(`🏁 Success: ${finalUrl}`);
        await browser.close();
        return { originalUrl: finalUrl };

    } catch (error) {
        console.log(`⚠️ Plan A Failed: ${error.message}`);
        if(browser) await browser.close();

        // Plan B: Try External API
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
