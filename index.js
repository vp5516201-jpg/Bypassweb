const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cors = require('cors');
const { URL } = require('url'); // URL parsing ke liye

const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// === 1. GOOGLE REDIRECT DECODER ===
// Agar link google.com/url?q=... hai to seedha asli link nikalo
function cleanGoogleLink(link) {
    if (link.includes('google.com/url')) {
        try {
            const urlObj = new URL(link);
            const realLink = urlObj.searchParams.get('q');
            if (realLink) return realLink;
        } catch (e) {}
    }
    return link;
}

// === 2. BACKUP API (Updated) ===
async function useExternalApi(url) {
    console.log("⚠️ Bot stuck. Trying Backup API...");
    try {
        // bypass.city abhi free aur working hai
        const response = await axios.get(`https://api.bypass.city/bypass?url=${encodeURIComponent(url)}`);
        if (response.data && (response.data.result || response.data.destination)) {
            const final = response.data.result || response.data.destination;
            console.log("✅ API Success: " + final);
            return final;
        }
    } catch (e) { console.log("❌ API Failed."); }
    return null;
}

// === 3. MAIN BYPASS LOGIC ===
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
];

async function bypassLink(rawUrl) {
    // Pehle check karo agar ye Google Redirect hai
    const url = cleanGoogleLink(rawUrl);
    
    // Agar Google Drive/Docs hi hai, to process mat karo, wapas de do
    if (url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('mega.nz')) {
        return { originalUrl: url };
    }

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

        // Tab Handling permission
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(url, ['clipboard-read']);

        let page = await browser.newPage();
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

        // Speed Boost (Images Block)
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

        // === SPECIAL AROLINKS & GENERAL HUNTER ===
        for (let i = 0; i < 4; i++) { // 4 Steps tak try karega
            console.log(`🔄 Check ${i+1}: ${page.url()}`);
            
            // 1. Scroll
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            
            // 2. Wait (Arolinks 10-15s timer leta hai)
            // Agar URL me 'arolinks' ya 'blog' hai to zyada wait karo
            const currentUrl = page.url();
            const isHeavySite = currentUrl.includes('arolinks') || currentUrl.includes('wblaxmibhandar') || currentUrl.includes('tech');
            await new Promise(r => setTimeout(r, isHeavySite ? 12000 : 5000));

            // 3. Click Logic (Pop-up Handling Included)
            try {
                // New Tab detect karne ke liye listener
                const newTargetPromise = browser.waitForTarget(target => target.opener() === page.target())
                    .catch(() => null);

                const clicked = await page.evaluate(() => {
                    // Arolinks specific keywords added
                    const keywords = ['get link', 'open link', 'continue', 'verify', 'go to link', 'click here', 'click to continue', 'generate link'];
                    const buttons = document.querySelectorAll('a, button, div.btn, span.btn, input[type="submit"]');
                    
                    for (let btn of buttons) {
                        const txt = btn.innerText ? btn.innerText.toLowerCase() : "";
                        // Visibility check + Keyword check
                        if (keywords.some(k => txt.includes(k)) && btn.offsetParent !== null) {
                            // Ads wale buttons (fake download) avoid karo
                            if (!txt.includes('download app') && !txt.includes('play')) {
                                btn.click();
                                return true;
                            }
                        }
                    }
                    return false;
                });
                
                if (clicked) {
                    console.log("✅ Clicked!");
                    
                    // Check for new tab (Arolinks opens destination in new tab often)
                    const newTarget = await newTargetPromise;
                    if (newTarget) {
                        console.log("🔀 New Tab Detected (Possible Destination)");
                        page = await newTarget.page();
                        await page.bringToFront();
                        // Naye tab par bhi interceptor lagao
                        try {
                            await page.setRequestInterception(true);
                            page.on('request', r => ['image','media'].includes(r.resourceType()) ? r.abort() : r.continue());
                        } catch(e){}
                    }
                    
                    await new Promise(r => setTimeout(r, 4000));
                }
            } catch(e) {}

            // Update Final URL
            try { finalDestination = page.url(); } catch(e) {}
            
            // 4. DESTINATION CHECK (Google / Mega / Mediafire)
            if (finalDestination.includes('drive.google') || finalDestination.includes('docs.google') || finalDestination.includes('mega.nz') || finalDestination.includes('mediafire') || finalDestination.includes('youtube')) {
                break; // Manzil mil gayi
            }
        }

        await browser.close();

        // FAIL CHECK (Agar abhi bhi shortener domain par hai)
        if (finalDestination.includes('arolinks') || finalDestination.includes('wblaxmibhandar') || finalDestination.includes('1ksfy')) {
            throw new Error("Stuck on Landing Page");
        }

        console.log(`🏁 Success: ${finalDestination}`);
        return { originalUrl: finalDestination };

    } catch (error) {
        console.log(`⚠️ Bot Failed. Using Backup API.`);
        if(browser) await browser.close();

        // PLAN B Call
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
