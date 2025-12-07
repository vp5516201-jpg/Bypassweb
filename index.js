const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cors = require('cors');

// Stealth Magic (Taaki bot pakda na jaye)
const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// Proxy List Logic
const PROXY_API = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all';
let proxyList = [];

async function updateProxies() {
    try {
        const response = await axios.get(PROXY_API);
        proxyList = response.data.split('\r\n').filter(p => p);
        console.log(`Updated: ${proxyList.length} proxies.`);
    } catch (e) { console.log("Proxy update failed"); }
}
updateProxies();
setInterval(updateProxies, 600000);

async function bypassLink(url) {
    let browser = null;
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    
    // Agar proxy nahi mili to bina proxy ke try karega (Fail hone se acha hai)
    const proxyArgs = proxy ? [`--proxy-server=http://${proxy}`] : [];

    try {
        console.log("Launching Lite Browser...");
        
        browser = await puppeteerExtra.launch({
            args: [
                ...chromium.args,
                ...proxyArgs,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--no-zygote'
            ],
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        
        // Block Heavy Assets (Images/Fonts/CSS) - RAM Bachane ke liye
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.setDefaultNavigationTimeout(60000);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Scroll Logic (View Count ke liye)
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
                }, 200);
            });
        });

        await new Promise(r => setTimeout(r, 15000)); // 15 sec wait

        const finalUrl = page.url();
        await browser.close();
        return { originalUrl: finalUrl };

    } catch (error) {
        console.error(error);
        if(browser) await browser.close();
        return { error: "Failed. Try Again." };
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
