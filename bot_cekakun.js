require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { chromium } = require('playwright');
const fetch = require('node-fetch');

// ==============================================================================
// 🌍 DATABASE KAMUS GLOBAL (FRASA PANJANG ANTI-JEBAKAN FOOTER)
// ==============================================================================
const KAMUS_HOLD_PAYMENT = [
    // Standar CC Hold (Frasa Pasti)
    'update your payment information', 'unable to process your last payment', 'update payment method', 'account on hold',
    'perbarui pembayaran', 'metode pembayaran Anda', 'faktur',
    'อัปเดตการชำระเงิน',
    'cập nhật thanh toán',
    'actualiza la información de pago',
    'atualizar a forma de pagamento',
    'mettre à jour les informations de paiement',
    'zahlungsart aktualisieren',
    'metodo di pagamento',
    'päivitä maksutiedot',
    'zaktualizuj metodę płatności',
    'aktualizovat platbu',
    'fizetés frissítése',
    'actualizează plata',
    'обновите способ оплаты',
    'お支払い方法の更新',
    '결제 수단 업데이트',
    '更新您的付款方式',
    'تحديث طريقة الدفع',
    
    // Provider / Telco Hold
    'contact your provider', 'temporary hold', 'start watching again',
    'hubungi penyedia', 'ditahan sementara',
    'comunícate con tu proveedor', 'suspensión temporal',
    'entre em contato com seu provedor', 'suspensão temporária',
    'contacter votre fournisseur', 'suspension temporaire'
];

const KAMUS_GEO_LOCK = [
    // Standar Geo & Household (Frasa Pasti)
    'not available in your region', 'not available in this region',
    'ad-supported plan is not available', 'not part of the netflix household',
    'tidak tersedia di wilayah', 'bukan bagian dari netflix household',
    'ไม่มีให้บริการในภูมิภาค', 'ไม่ได้อยู่ในครัวเรือน',
    'không khả dụng ở khu vực', 'không thuộc hộ gia đình',
    'no disponible en esta región', 'no es parte del hogar',
    'não está disponível nesta região', 'não faz parte da residência',
    'pas disponible dans cette région', 'ne fait pas partie du foyer',
    'in dieser region nicht verfügbar', 'nicht teil des netflix-haushalts',
    'non è disponibile in questa regione', 'non fa parte del nucleo domestico',
    'niet beschikbaar in deze regio',
    'inte tillgängligt i denna region', 'inte del av netflix-hushållet',
    'ikke tilgængeligt i denne region', 'ikke en del af netflix-husstanden',
    'ei saatavilla tällä alueella', 'ei kuulu netflix-kotitalouteen',
    'bu bölgede kullanılamıyor', 'netflix hanesine dahil değil',
    'niedostępny w tym regionie',
    'není v tomto regionu k dispozici',
    'ebben a régióban nem elérhető',
    'indisponibil în această regiune',
    'недоступно в этом регионе',

    // X-Ray Keyword Jepang & Korea (Kombinasi Kanji & Hiragana)
    'ご契約の広告つきプランは', 'この地域ではご利用', 'ご利用いただけません', 
    'プランを利用可能な地域でご視聴ください', 'プランを変更して、この地域で視聴', 
    '広告付き', '広告つき', 'ご契約の広告', '広告つきプラン',
    '이 지역에서는 시청할 수 없습니다', '광고형'
];

// --- INISIALISASI BOT & STATE ---
const bot = new Telegraf(process.env.BOT_TOKEN || 'TARUH_TOKEN_BOT_KAMU_DISINI'); 
const activeCekAkunSessions = new Map(); 

const taskQueue = [];
let isWorkerRunning = false;
let currentWorkerTask = null;

// --- BANNER TERMINAL CYBER AESTHETIC ---
function showCyberBanner() {
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const bold = "\x1b[1m";
    const reset = "\x1b[0m";
    const gray = "\x1b[90m";

    console.log(`\n${cyan}${bold}  ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗   ███╗   ███╗██╗███╗   ██╗██╗███╗   ██╗███████╗${reset}`);
    console.log(`${cyan}${bold} ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝   ████╗ ████║██║████╗  ██║██║████╗  ██║██╔════╝${reset}`);
    console.log(`${cyan}${bold} ██║     ███████║█████╗  ██║     █████╔╝    ██╔████╔██║██║██╔██╗ ██║██║██╔██╗ ██║█████╗  ${reset}`);
    console.log(`${cyan}${bold} ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗    ██║╚██╔╝██║██║██║╚██╗██║██║██║╚██╗██║██╔══╝  ${reset}`);
    console.log(`${cyan}${bold} ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗   ██║ ╚═╝ ██║██║██║ ╚████║██║██║ ╚████║███████╗${reset}`);
    console.log(`${cyan}${bold}  ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝   ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═══╝╚══════╝${reset}`);
    console.log(`${cyan}${bold} ==========================================================================================${reset}`);
    console.log(` ${green}${bold}[SYSTEM ONLINE]${reset} CHECK ACCOUNT NETFLIX AGASTRA - CORE V21.0 (ANTI-TRAP PRECISION)`);
    console.log(` ${gray}[${new Date().toLocaleTimeString()}]${reset} Playwright Engine: Ready | Secure Tunnel: Active`);
    console.log(`${cyan}${bold} ==========================================================================================${reset}\n`);
}

// --- FUNGSI PEMINDAI DOM (X-RAY EXTRACTOR & ELEMENT TARGETING) ---
async function scanForRestrictions(page, rawCookieString) {
    const url = page.url().toLowerCase();
    if (url.includes('/payment') || url.includes('/billing') || url.includes('/clearpay')) {
        return { status: 'HOLD' };
    }

    // 🔥 FIX 1: Pengecekan Langsung ke Elemen DOM Pop-Up Hold Payment
    const isHoldElement = await page.$('[data-uia="action_update_payment"], [data-uia="payment-update-container"], button:has-text("Update Payment Method")').catch(() => null);
    if (isHoldElement) return { status: 'HOLD' };

    // 🔥 FIX 2: Tarik Teks X-Ray yang bersih dari script
    const textData = await page.evaluate(() => {
        try {
            const clone = document.body.cloneNode(true);
            const scripts = clone.querySelectorAll('script, style, noscript, svg, img');
            scripts.forEach(s => s.remove());
            const rawText = clone.textContent || '';
            return {
                withSpace: rawText.toLowerCase().replace(/[\r\n\t]+/g, ' '),
                noSpace: rawText.toLowerCase().replace(/\s+/g, '')
            };
        } catch(e) { 
            return { withSpace: '', noSpace: '' }; 
        }
    });

    const htmlContent = (await page.content()).toLowerCase(); 

    // 🔥 FIX 3: Hapus string pendek 'e114/e116' yang memicu False Geo-Lock dari kode Hash Netflix.
    const hasGeoCode = ['m7111-5059', 'm7111-1331'].some(c => htmlContent.includes(c));
    if (hasGeoCode) return { status: 'GEO_LOCKED', cookie: rawCookieString };

    // Scanner Kamus X-Ray Dua Arah
    const isHold = KAMUS_HOLD_PAYMENT.some(kw => {
        const cleanKw = kw.toLowerCase();
        const tightKw = cleanKw.replace(/\s+/g, '');
        return textData.withSpace.includes(cleanKw) || textData.noSpace.includes(tightKw);
    });
    if (isHold) return { status: 'HOLD' };
    
    const isGeoLock = KAMUS_GEO_LOCK.some(kw => {
        const cleanKw = kw.toLowerCase();
        const tightKw = cleanKw.replace(/\s+/g, '');
        return textData.withSpace.includes(cleanKw) || textData.noSpace.includes(tightKw);
    });
    if (isGeoLock) return { status: 'GEO_LOCKED', cookie: rawCookieString };

    return null; 
}

async function startGlobalBrowser() {
    console.log(`\x1b[33m[PROCESS]\x1b[0m Memulai global Chromium instance...`);
    try {
        globalBrowser = await chromium.launch({ 
            headless: true, 
            args: [
                '--disable-blink-features=AutomationControlled', 
                '--no-sandbox', 
                '--disable-dev-shm-usage',
                '--autoplay-policy=no-user-gesture-required'
            ],
            ignoreDefaultArgs: ['--disable-component-update']
        });
        console.log(`\x1b[32m[SUCCESS]\x1b[0m Chromium instance berhasil diinisialisasi.`);
    } catch (error) {
        console.error(`\x1b[31m[ERROR]\x1b[0m Gagal memulai browser:`, error);
    }
}

async function startGlobalBrowser() {
    console.log(`\x1b[33m[PROCESS]\x1b[0m Memulai global Chromium instance...`);
    globalBrowser = await chromium.launch({ 
        headless: true, // <--- UBAH JADI TRUE
        // channel: 'chrome', <--- HAPUS ATAU COMMENT BARIS INI
        args: [
            '--disable-blink-features=AutomationControlled', 
            '--no-sandbox', 
            '--disable-dev-shm-usage',
            '--autoplay-policy=no-user-gesture-required'
        ],
        ignoreDefaultArgs: ['--disable-component-update']
    });
    console.log(`\x1b[32m[SUCCESS]\x1b[0m Chromium instance berhasil diinisialisasi.`);
}

// --- FUNGSI UTAMA PENGECEKAN BROWSER ---
async function processCekAkunTarget(targetUrl, updateStatusCallback) {
    let context = null;
    let page = null;
    
    try {
        if (!globalBrowser) await startGlobalBrowser();
        
        if (updateStatusCallback) await updateStatusCallback("<code>> [▓░░░░░░░░░] 10%</code>\n🚀 <b>sys:</b> <i>membuka konteks browser & inisialisasi sesi...</i>");

        context = await globalBrowser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale: 'id-ID' 
        });
        
        page = await context.newPage();
        
        if (updateStatusCallback) await updateStatusCallback("<code>> [▓▓▓░░░░░░░] 30%</code>\n🔗 <b>net:</b> <i>mengakses tautan autentikasi login...</i>");
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await page.waitForTimeout(3000); 

        const currentUrl = page.url().toLowerCase();
        const pageBodyText = (await page.evaluate(() => document.body.innerText).catch(() => '')).toLowerCase();
        const isLoggedOutBtn = await page.$('a[data-uia="header-login-link"], a[href="/login"]');
        
        const isDeadToken = currentUrl.includes('/login') || 
                            currentUrl.includes('/signout') || 
                            await page.$('form[data-uia="login-form"]') || 
                            isLoggedOutBtn !== null ||
                            pageBodyText.includes('sign in') ||
                            pageBodyText.includes('iniciar sesión') ||
                            pageBodyText.includes('masukkan email') || 
                            pageBodyText.includes('ready to watch? enter your email'); 

        if (isDeadToken) {
            if (updateStatusCallback) await updateStatusCallback("<code>> [❌ KODE MATI]</code>\n💀 <b>status:</b> <i>tautan kedaluwarsa (terdeteksi halaman public / login). Memutus proses...</i>");
            await page.waitForTimeout(1500);
            return { status: 'DEAD' };
        }

        const initialContent = await page.content();
        if (initialContent.includes('Back to Netflix') || initialContent.includes('Kembali ke Netflix')) {
            const backButton = await page.$('a[href="/"], button[data-uia="error-page-back-to-home"]');
            if (backButton) {
                await backButton.click();
                await page.waitForTimeout(3000); 
            }
        }

        const cookies = await context.cookies();
        let netflixId = '', secureNetflixId = '';
        cookies.forEach(c => {
            if (c.name === 'NetflixId') netflixId = c.value;
            if (c.name === 'SecureNetflixId') secureNetflixId = c.value;
        });
        const rawCookieString = `NetflixId=${netflixId}; SecureNetflixId=${secureNetflixId};`;

        if (!page.url().includes('/browse')) {
            if (updateStatusCallback) await updateStatusCallback("<code>> [▓▓▓▓▓░░░░░] 50%</code>\n🏠 <b>route:</b> <i>mengarahkan ke beranda /browse...</i>");
            await page.goto('https://www.netflix.com/browse', { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(()=>{});
            await page.waitForTimeout(4000); 
        }

        if (updateStatusCallback) await updateStatusCallback("<code>> [▓▓▓▓▓▓▓░░░] 75%</code>\n🔍 <b>scan:</b> <i>memindai layar beranda dari hold payment & geo-lock...</i>");
        let restriction = await scanForRestrictions(page, rawCookieString);
        if (restriction) return restriction;

        let profileSelected = false;
        const profileCount = await page.evaluate(() => document.querySelectorAll('.profile-link').length).catch(() => 0);

        if (profileCount > 0) {
            if (updateStatusCallback) await updateStatusCallback("<code>> [▓▓▓▓▓▓▓▓░░] 85%</code>\n👤 <b>profile:</b> <i>layar profil terdeteksi, mencoba menembus profil utama...</i>");
            const maxChecks = Math.min(profileCount, 3); 

            for (let i = 0; i < maxChecks; i++) {
                try {
                    if (!page.url().includes('/browse')) {
                        await page.goto('https://www.netflix.com/browse', { waitUntil: 'domcontentloaded' }).catch(()=>{});
                        await page.waitForTimeout(3000);
                    }

                    await page.waitForSelector('.profile-link', { timeout: 8000 }).catch(()=>{});
                    const profiles = await page.$$('.profile-link');
                    
                    if (!profiles[i]) continue;

                    await profiles[i].click();
                    await page.waitForTimeout(4000); 

                    const isPin = await page.evaluate(() => {
                        return window.location.href.includes('pin') || !!document.querySelector('[data-uia="pin-container"]');
                    }).catch(() => false);

                    if (isPin) {
                        if (updateStatusCallback) await updateStatusCallback(`<code>> [▓▓▓▓▓▓▓▓░░] 85%</code>\n🔐 <b>profile:</b> <i>profil ke-${i+1} terkunci PIN! Melompat ke profil berikutnya...</i>`);
                        continue; 
                    }
                    
                    // Jeda sejenak untuk membiarkan animasi modal Hold Payment muncul
                    await page.waitForTimeout(2000);
                    restriction = await scanForRestrictions(page, rawCookieString);
                    if (restriction) return restriction;

                    profileSelected = true;
                    break; 
                } catch (err) {}
            }

            if (!profileSelected && !page.url().includes('/watch') && !page.url().includes('/browse')) {
                return { status: 'ERROR' }; 
            }
        } else {
            profileSelected = true;
        }

        if (updateStatusCallback) await updateStatusCallback("<code>> [▓▓▓▓▓▓▓▓▓░] 90%</code>\n🎬 <b>player:</b> <i>menunggu elemen pemutar video & mengeklik tombol play...</i>");
        try {
            const playSelector = [
                '[data-uia*="play-button"]', 'a[href*="/watch/"]', 'button[data-uia*="play"]',
                'a[data-uia*="play"]', '.playLink', '.billboard-row a.playLink', '.billboard a.playLink'
            ].join(', ');

            const playButton = await page.waitForSelector(playSelector, { state: 'attached', timeout: 12000 });
            await page.evaluate(btn => btn.click(), playButton);
        } catch (error) {
            // 🔥 FIX 4: Pindai layarnya sekali lagi SEBELUM pindah paksa ke /watch/
            // Ini yang bikin Bulk kemarin false-negative dan dianggap Normal!
            restriction = await scanForRestrictions(page, rawCookieString);
            if (restriction) return restriction;

            await page.goto('https://www.netflix.com/watch/80018499', { waitUntil: 'domcontentloaded' }).catch(()=>{});
        }

        if (updateStatusCallback) await updateStatusCallback("<code>> [▓▓▓▓▓▓▓▓▓▓] 95%</code>\n🌐 <b>sensor:</b> <i>memverifikasi integritas streaming & memindai sensor wilayah (9s)...</i>");
        await page.waitForTimeout(9000); 

        // Scanner Pamungkas berjalan di sini
        restriction = await scanForRestrictions(page, rawCookieString);
        if (restriction) return restriction;

        const currentUrlFinal = page.url().toLowerCase();
        const isPlayerActive = currentUrlFinal.includes('/watch') || await page.$('.watch-video, .video-player, video').catch(()=>null);

        if (isPlayerActive || profileSelected || currentUrlFinal.includes('/browse')) {
            return { status: 'NORMAL_INDO', cookie: rawCookieString };
        }

        return { status: 'NORMAL_INDO', cookie: rawCookieString };

    } catch (err) {
        return { status: 'ERROR' };
    } finally {
        if (page) await page.close().catch(()=>{});
    }
}

// ==============================================================================
// 🤖 MESIN ANTRIAN & PEKERJA (QUEUE WORKER)
// ==============================================================================
async function runQueueWorker() {
    if (isWorkerRunning) return; 
    isWorkerRunning = true;

    while (taskQueue.length > 0) {
        currentWorkerTask = taskQueue[0];
        const task = currentWorkerTask;

        console.log(`\x1b[36m[QUEUE]\x1b[0m Memulai tugas dari @${task.username} (${task.type.toUpperCase()})`);

        try {
            await task.ctx.reply(`🔔 <b>[ NOTIFIKASI ANTRIAN ]</b>\n<i>Halo @${task.username}, sekarang giliran Anda! Sistem sedang mengeksekusi data... 🚀</i>`, { parse_mode: 'html' }).catch(()=>{});

            const updateStatus = async (htmlText) => {
                await task.ctx.telegram.editMessageText(task.chatId, task.statusMsgId, undefined, htmlText, { parse_mode: 'html' }).catch(()=>{});
            };

            if (task.type === 'single') {
                const result = await processCekAkunTarget(task.links[0], updateStatus);
                task.progress = 1;

                await task.ctx.telegram.deleteMessage(task.chatId, task.statusMsgId).catch(()=>{});

                if (result.status === 'NORMAL_INDO') {
                    await task.ctx.reply(`✅ <b>Status: NORMAL (Access Granted)</b>\n\n> Akun beroperasi normal tanpa retriksi.\n> Tidak ditemukan pemblokiran wilayah (Geo-Lock).\n> Lolos uji pemutaran media.\n\n> <b>Sesi Cookie Aktif:</b>\n<code>${result.cookie}</code>`, { parse_mode: 'html' });
                } else if (result.status === 'HOLD') {
                    await task.ctx.reply(`❌ <b>Status: HOLD PAYMENT (Access Denied)</b>\n\n> Akun ditangguhkan akibat kendala pembayaran atau kebijakan penyedia pihak ketiga.`, { parse_mode: 'html' });
                } else if (result.status === 'GEO_LOCKED') {
                    await task.ctx.reply(`❌ <b>Status: GEO-LOCKED / AD-PLAN (Access Denied)</b>\n\n> Terdeteksi pemblokiran wilayah atau kebijakan paket iklan. Anda memerlukan VPN yang sesuai untuk mengaksesnya.`, { parse_mode: 'html' });
                } else if (result.status === 'DEAD') {
                    await task.ctx.reply(`❌ <b>Status: EXPIRED (Session Dead)</b>\n\n> Tautan autentikasi telah kedaluwarsa atau akun sudah dinonaktifkan.`, { parse_mode: 'html' });
                } else {
                    await task.ctx.reply(`⚠️ <b>Status: DIAGNOSTIC FAILED</b>\n\n> Pemeriksaan gagal (Kemungkinan seluruh profil terkunci PIN atau waktu pemuatan habis).`, { parse_mode: 'html' });
                }

            } else if (task.type === 'bulk') {
                let results = { NORMAL: [], GEO_LOCKED: [], HOLD: [], DEAD: [], ERROR: [] };
        
                for (let i = 0; i < task.links.length; i++) {
                    task.progress = i; 
                    
                    const liveCallback = async (htmlText) => {
                        const progressHeader = `🚀 <b>[BULK REAL-TIME EXECUTOR]</b>\n👤 <b>Klien:</b> @${task.username}\n📦 <b>Pemrosesan:</b> Akun ${i + 1} dari ${task.links.length}\n\n`;
                        await task.ctx.telegram.editMessageText(task.chatId, task.statusMsgId, undefined, progressHeader + htmlText, { parse_mode: 'html' }).catch(()=>{});
                    };

                    const linkTarget = task.links[i];
                    const res = await processCekAkunTarget(linkTarget, liveCallback);
                    
                    if (res.status === 'NORMAL_INDO') results.NORMAL.push({ link: linkTarget, cookie: res.cookie });
                    else if (res.status === 'GEO_LOCKED') results.GEO_LOCKED.push({ link: linkTarget, cookie: res.cookie });
                    else if (res.status === 'HOLD') results.HOLD.push(linkTarget);
                    else if (res.status === 'DEAD') results.DEAD.push(linkTarget);
                    else results.ERROR.push(linkTarget);
                }

                task.progress = task.links.length; 
                await task.ctx.telegram.deleteMessage(task.chatId, task.statusMsgId).catch(()=>{});
        
                const summaryMsg = 
                    `✅ <b>PROSES MASSAL SELESAI (@${task.username})</b>\n\n` +
                    `📊 <b>Laporan Penyortiran Sistem (${task.links.length} Tautan):</b>\n` +
                    `> ✅ Normal / Aman: <b>${results.NORMAL.length}</b>\n` +
                    `> 🌐 Geo-Locked: <b>${results.GEO_LOCKED.length}</b>\n` +
                    `> 💳 Hold Payment: <b>${results.HOLD.length}</b>\n` +
                    `> 💀 Expired / Mati: <b>${results.DEAD.length}</b>\n` +
                    `> ⚠️ Error / Anomali: <b>${results.ERROR.length}</b>\n\n` +
                    `<i>Sistem sedang merangkum dan mengirimkan berkas laporan per kategori...</i>`;
                
                await task.ctx.reply(summaryMsg, { parse_mode: 'html' });
        
                const timestamp = Date.now();
        
                if (results.NORMAL.length > 0) {
                    let txt = `=== HASIL SORTIR: NORMAL & AMAN (${results.NORMAL.length} AKUN) ===\n\n`;
                    results.NORMAL.forEach((item, idx) => { txt += `[AKUN NORMAL #${idx+1}]\nLink: ${item.link}\nCookies:\n${item.cookie}\n\n`; });
                    await task.ctx.replyWithDocument({ source: Buffer.from(txt, 'utf-8'), filename: `NORMAL_AMAN_${timestamp}.txt` });
                }
        
                if (results.GEO_LOCKED.length > 0) {
                    let txt = `=== HASIL SORTIR: GEO-LOCKED / AD-PLAN (${results.GEO_LOCKED.length} AKUN) ===\n\n`;
                    results.GEO_LOCKED.forEach((item, idx) => { txt += `[AKUN GEO-LOCK #${idx+1}]\nLink: ${item.link}\nCookies:\n${item.cookie}\n\n`; });
                    await task.ctx.replyWithDocument({ source: Buffer.from(txt, 'utf-8'), filename: `GEO_LOCKED_${timestamp}.txt` });
                }
        
                if (results.HOLD.length > 0) {
                    let txt = `=== HASIL SORTIR: HOLD PAYMENT (${results.HOLD.length} AKUN) ===\n\n`;
                    results.HOLD.forEach((link, idx) => { txt += `${idx+1}. ${link}\n`; });
                    await task.ctx.replyWithDocument({ source: Buffer.from(txt, 'utf-8'), filename: `HOLD_PAYMENT_${timestamp}.txt` });
                }
        
                if (results.DEAD.length > 0) {
                    let txt = `=== HASIL SORTIR: DEAD / EXPIRED (${results.DEAD.length} AKUN) ===\n\n`;
                    results.DEAD.forEach((link, idx) => { txt += `${idx+1}. ${link}\n`; });
                    await task.ctx.replyWithDocument({ source: Buffer.from(txt, 'utf-8'), filename: `DEAD_EXPIRED_${timestamp}.txt` });
                }
        
                if (results.ERROR.length > 0) {
                    let txt = `=== HASIL SORTIR: ERROR / ANOMALI (${results.ERROR.length} AKUN) ===\n\n`;
                    results.ERROR.forEach((link, idx) => { txt += `${idx+1}. ${link}\n`; });
                    await task.ctx.replyWithDocument({ source: Buffer.from(txt, 'utf-8'), filename: `ERROR_ANOMALI_${timestamp}.txt` });
                }
            }
        } catch (err) {
            console.error(`[QUEUE ERROR] Task gagal:`, err);
            await task.ctx.reply(`⚠️ <i>Terjadi kesalahan internal pada sistem saat memproses tugas milik @${task.username}.</i>`, { parse_mode: 'html' }).catch(()=>{});
        }

        taskQueue.shift();
        currentWorkerTask = null;
    }

    isWorkerRunning = false;
    console.log(`\x1b[32m[QUEUE]\x1b[0m Semua antrian selesai dikerjakan. Bot kembali idle.`);
}

// --- COMMAND BOT TELEGRAM ---
bot.start((ctx) => {
    const welcomeMessage = 
        `👋 <b>Selamat datang di Netflix Account Scanner Bot</b>\n` +
        `<i>(Agastra Enterprise - Core Engine)</i>\n\n` +
        `Sistem ini dirancang secara profesional untuk memverifikasi dan menyortir tautan autentikasi (nftoken) Netflix secara otomatis.\n\n` +
        `<b>🔧 Kemampuan Sistem:</b>\n` +
        `• Deteksi status <b>Normal</b>, <b>Hold Payment</b>, <b>Geo-Locked</b>, dan <b>Expired</b>.\n` +
        `• Penetrasi keamanan dan bypass profil dasar (termasuk deteksi PIN).\n` +
        `• <b>Bulk Checker</b>: Pengecekan massal menggunakan file <code>.txt</code>.\n` +
        `• Output laporan rapi dengan pemisahan file berdasarkan kategori.\n\n` +
        `<b>📌 Daftar Perintah:</b>\n` +
        `👉 /cekakun - Memulai sesi pengecekan akun.\n` +
        `👉 /cekantrian - Memantau status dan posisi antrian Anda.\n\n` +
        `<i>Silakan gunakan perintah di atas untuk mulai berinteraksi dengan sistem.</i>`;

    ctx.reply(welcomeMessage, { parse_mode: 'html' });
});

bot.command('cekakun', (ctx) => {
    activeCekAkunSessions.set(ctx.from.id, true);
    const textGuide = 
        `<b>[ MODUL: CHECK ACCOUNT NETFLIX ]</b>\n` +
        `──────────────────────────────\n` +
        `<i>Silakan kirimkan tautan login (nftoken) secara langsung atau unggah berkas berformat <b>.txt</b> untuk pengecekan massal (Bulk Link).</i>\n\n` +
        `<b>Parameter Filter Sistem:</b>\n` +
        `<code>[✓]</code> Deteksi Hold Payment / Penangguhan Telco\n` +
        `<code>[✓]</code> Deteksi Geo-Lock / Paket Iklan / Pembatasan VPN\n` +
        `<code>[✓]</code> Validasi Operasional Normal\n\n` +
        `👉 <i>Sistem menunggu input Anda...</i>`;
    ctx.reply(textGuide, { parse_mode: 'html' });
});

bot.command('cekantrian', (ctx) => {
    if (!currentWorkerTask && taskQueue.length === 0) {
        return ctx.reply("🟢 <b>Sistem Idle (Antrian Kosong)</b>\nMesin siap digunakan. Silakan kirimkan tautan atau berkas .txt Anda.", { parse_mode: 'html' });
    }

    let text = `📊 <b>STATUS ANTRIAN SISTEM (LIVE)</b>\n──────────────────────\n\n`;

    if (currentWorkerTask) {
        text += `🔄 <b>PROSES BERJALAN SAAT INI:</b>\n`;
        text += `👤 <b>@${currentWorkerTask.username}</b> | Target: <b>${currentWorkerTask.total}</b> akun <i>(Selesai: ${currentWorkerTask.progress})</i>.\n\n`;
    }

    if (taskQueue.length > 1) {
        text += `⏳ <b>DAFTAR TUNGGU ANTRIAN:</b>\n`;
        for (let i = 1; i < taskQueue.length; i++) {
            text += `${i}. 👤 <b>@${taskQueue[i].username}</b> (${taskQueue[i].total} akun)\n`;
        }
        text += `\n`;
    }

    const isCurrent = currentWorkerTask && currentWorkerTask.userId === ctx.from.id;
    const queueIndex = taskQueue.findIndex((t, idx) => idx !== 0 && t.userId === ctx.from.id);

    if (isCurrent) {
        text += `📍 <b>STATUS ANDA:</b> Data Anda sedang diproses oleh sistem saat ini! 🔥`;
    } else if (queueIndex !== -1) {
        text += `📍 <b>STATUS ANDA:</b> Anda berada di urutan antrian ke-<b>${queueIndex}</b>.`;
    } else {
        text += `📍 <b>STATUS ANDA:</b> Anda belum memasukkan data ke dalam antrian. Ketik /cekakun untuk memulai.`;
    }

    ctx.reply(text, { parse_mode: 'html' });
});

bot.on('document', async (ctx) => {
    if (!activeCekAkunSessions.get(ctx.from.id)) return;

    const document = ctx.message.document;
    if (!document.file_name.endsWith('.txt')) {
        return ctx.reply("⚠️ <i>Format berkas ditolak. Sistem hanya menerima ekstensi .txt yang berisi daftar tautan.</i>", { parse_mode: 'html' });
    }

    const initMsg = await ctx.reply("⏳ <i>Mengunduh berkas & meregistrasi ke dalam sistem antrian...</i>", { parse_mode: 'html' });

    try {
        const fileLink = await ctx.telegram.getFileLink(document.file_id);
        const response = await fetch(fileLink.href); 
        const textContent = await response.text();

        const rawLinks = textContent.match(/https?:\/\/[^\s]*netflix\.com[^\s]*nftoken=[^\s]+/gi);
        
        if (!rawLinks || rawLinks.length === 0) {
            return ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "⚠️ <i>Tidak ditemukan tautan Netflix (nftoken) yang valid di dalam berkas tersebut.</i>", { parse_mode: 'html' });
        }

        const username = ctx.from.username || ctx.from.first_name || 'Klien';
        
        taskQueue.push({
            userId: ctx.from.id,
            username: username,
            chatId: ctx.chat.id,
            type: 'bulk',
            links: rawLinks,
            total: rawLinks.length,
            progress: 0,
            statusMsgId: initMsg.message_id,
            ctx: ctx
        });

        const posisi = taskQueue.length - 1;
        let infoAntrian = posisi === 0 ? "Pemrosesan dimulai." : `Menunggu di antrian ke-${posisi}. (Gunakan /cekantrian untuk rincian)`;
        
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            initMsg.message_id, 
            undefined, 
            `📥 <b>DATA DITERIMA</b>\n\nSistem mengidentifikasi ${rawLinks.length} tautan valid.\n📍 Status: ${infoAntrian}`, 
            { parse_mode: 'html' }
        );

        runQueueWorker();

    } catch (error) {
        console.error(error);
        await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, "⚠️ <i>Kegagalan sistem saat memproses berkas input.</i>", { parse_mode: 'html' });
    }
});

bot.on('text', async (ctx) => {
    const rawText = ctx.message.text;

    if (activeCekAkunSessions.get(ctx.from.id)) {
        if (rawText.includes('netflix.com/') && rawText.includes('nftoken=')) {
            
            const urlMatch = rawText.match(/(https?:\/\/[^\s]*netflix\.com[^\s]*nftoken=[^\s]+)/i);
            if (!urlMatch) return ctx.reply("⚠️ <i>Tautan tidak valid atau format penulisan salah.</i>", { parse_mode: 'html' });
            
            const targetUrl = urlMatch[1];
            const initMsg = await ctx.reply("⏳ <i>Meregistrasi tautan ke sistem antrian...</i>", { parse_mode: 'html' });
            
            const username = ctx.from.username || ctx.from.first_name || 'Klien';

            taskQueue.push({
                userId: ctx.from.id,
                username: username,
                chatId: ctx.chat.id,
                type: 'single',
                links: [targetUrl],
                total: 1,
                progress: 0,
                statusMsgId: initMsg.message_id,
                ctx: ctx
            });

            const posisi = taskQueue.length - 1;
            let infoAntrian = posisi === 0 ? "Menyiapkan mesin virtual..." : `📍 Menunggu di antrian ke-${posisi}.`;
            
            await ctx.telegram.editMessageText(ctx.chat.id, initMsg.message_id, undefined, infoAntrian, { parse_mode: 'html' }).catch(()=>{});

            runQueueWorker();
        }
    }
});

bot.launch().then(() => showCyberBanner());
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
