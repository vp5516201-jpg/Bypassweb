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

// Proxy List
const PROXY_API = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all';
let proxyList = [];

async function updateProxies() {
    try {
        const response = await axios.get(PROXY_API);
        proxyList = response.data.split('\r\n').filter(p => p);
        console.log(`Updated: ${proxyList.length} proxies found.`);
    } catch (e) { console.log("Proxy update failed"); }
}
updateProxies();
setInterval(updateProxies, 600000); // 10 min refresh

async function bypassLink(url) {
    // 🔥 AUTO-RETRY SYSTEM (3 Times Try Karega)
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        let browser = null;
        
        // Random Proxy Pick Karo
        const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        // Agar Proxy list khali hai ya proxy fail ho rahi hai, to Direct try karo (Last attempt)
        const useProxy = (proxy && attempts < 3); 
        const proxyArgs = useProxy ? [`--proxy-server=http://${proxy}`] : [];

        console.log(`Attempt ${attempts}/${maxAttempts}: ${useProxy ? 'Using Proxy ' + proxy : 'Trying Direct Connection'}`);

        try {
            browser = await puppeteerExtra.launch({
                args: [
                    ...chromium.args,
                    ...proxyArgs,
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-setuid-sandbox',
                    '--no-sandbox',
                    '--no-zygote',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ],
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
                defaultViewport: chromium.defaultViewport,
                ignoreHTTPSErrors: true
            });

            const page = await browser.newPage();
            
            // Block Images/Fonts to save Data & Speed
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Timeout badhaya (Traffic jam se bachne ke liye)
            page.setDefaultNavigationTimeout(90000); 
            
            // Link Open Karo
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Agar yahan tak pahunche, matlab Success! 🎉
            // Ab View Count ke liye Scroll Karo
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight || totalHeight > 1500) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 200);
                });
            });

            await new Promise(r => setTimeout(r, 12000)); // 12 sec wait

            const finalUrl = page.url();
            await browser.close();
            return { originalUrl: finalUrl };

        } catch (error) {
            console.error(`Attempt ${attempts} Failed: ${error.message}`);
            if (browser) await browser.close();
            // Loop wapas chalega aur nayi proxy try karega
        }
    }

    return { error: "All 3 Proxies Failed. Server Busy." };
}

app.get('/api/bypass', async (req, res) => {
    const url = req.query.url;
    if(!url) return res.json({ error: "No URL" });
    const result = await bypassLink(url);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
