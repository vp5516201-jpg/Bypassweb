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

// === NEW API LIST (Backup Plan) ===
// Agar ek fail hogi, dusri try karega
async function useExternalApi(url) {
    console.log("⚠️ Bot Stuck. Trying New Backup APIs...");
    
    // List of Free APIs (Priority wise)
    const apis = [
        `https://api.bypass.city/bypass?url=${encodeURIComponent(url)}`, 
        `https://api.adlinkfly.to/api?api=Your_Key&url=${encodeURIComponent(url)}` // Future me yahan key laga sakte ho
    ];

    for (let api of apis) {
        try {
            const response = await axios.get(api);
            if (response.data && (response.data.result || response.data.destination)) {
                const finalLink = response.data.result || response.data.destination;
                if(finalLink.startsWith('http')) {
                    console.log("✅ API Success: " + finalLink);
                    return finalLink;
                }
            }
        } catch (e) {
            console.log("❌ One API Failed, trying next...");
        }
    }
    return null;
}

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
                '--disable-popup-blocking' // Popups allow karo
            ],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
            ignoreHTTPSErrors: true
        });

        // Context override for new tabs
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(url, ['clipboard-read', 'clipboard-write']);

        let page = await browser.newPage();
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

        // Speed Boost
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

        // === 3 STEP ATTACK WITH TAB HANDLING ===
        for (let i = 0; i < 3; i++) {
            console.log(`🔄 Check ${i+1}: ${page.url()}`);
            
            // 1. Scroll
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            
            // 2. Wait
            const currentUrl = page.url();
            const isBlog = currentUrl.includes('wblaxmibhandar') || currentUrl.includes('superkheti') || currentUrl.includes('tech');
            await new Promise(r => setTimeout(r, isBlog ? 15000 : 5000));

            // 3. Clicker Logic
            try {
                // New Tab Listener Setup
                const newTargetPromise = browser.waitForTarget(target => target.opener() === page.target())
                    .catch(() => null); // Error ignore karo agar naya tab nahi khula

                const clicked = await page.evaluate(() => {
                    const keywords = ['get link', 'continue', 'verify', 'open', 'go to link', 'click here', 'scroll down'];
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
                    console.log("✅ Clicked! Checking for new tabs...");
                    
                    // Check agar naya tab khula (Popup handling)
                    const newTarget = await newTargetPromise;
                    if (newTarget) {
                        console.log("🔀 Switching to New Tab...");
                        page = await newTarget.page();
                        await page.bringToFront();
                        // Naye tab par bhi assets block karo
                        try {
                            await page.setRequestInterception(true);
                            page.on('request', r => ['image','media'].includes(r.resourceType()) ? r.abort() : r.continue());
                        } catch(e){}
                    }
                    
                    await new Promise(r => setTimeout(r, 5000));
                }
            } catch(e) {
                console.log("Click logic error: " + e.message);
            }

            // Update URL
            try {
                finalDestination = page.url();
            } catch(e) {
                finalDestination = "Error getting URL";
            }
            
            // SUCCESS CHECK
            if (finalDestination.includes('drive.google') || finalDestination.includes('mega.nz') || finalDestination.includes('mediafire')) {
                break;
            }
        }

        await browser.close();

        // FAIL CHECK
        if (finalDestination.includes('superkheti') || finalDestination.includes('wblaxmibhandar') || finalDestination.includes('1ksfy')) {
            throw new Error("Stuck on Landing Page");
        }

        console.log(`🏁 Success: ${finalDestination}`);
        return { originalUrl: finalDestination };

    } catch (error) {
        console.log(`⚠️ Bot Failed. Using FORCE API (New)...`);
        if(browser) await browser.close();

        // PLAN B: New API
        const apiLink = await useExternalApi(url);
        if (apiLink) {
            return { originalUrl: apiLink };
        }

        return { error: "Link is too hard. Try again later." };
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
