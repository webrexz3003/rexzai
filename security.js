// ============================================================
//  REXZAI SECURITY — Anti-Bot | Anti-DDoS | Backdoor Protection
//  Terpisah dari HTML, dipanggil via <script src="security.js">
// ============================================================

(function() {
    'use strict';

    // ============ KONFIGURASI KEAMANAN ============
    const SECURITY_CONFIG = {
        // Rate limiting ketat
        MAX_REQUESTS_PER_MINUTE: 10,
        MAX_REQUESTS_PER_HOUR: 50,
        MAX_REQUESTS_PER_DAY: 15,
        
        // Cooldown setelah kena limit
        COOLDOWN_MINUTES: 5,
        
        // Deteksi serangan
        SUSPICIOUS_THRESHOLD: 5,      // Jumlah request cepat berturut-turut
        SUSPICIOUS_WINDOW_MS: 3000,   // Dalam 3 detik
        BLOCK_DURATION_MINUTES: 30,   // Blokir 30 menit
        
        // Anti-scraping
        MIN_MOUSE_MOVEMENTS: 3,
        MIN_SCROLL_EVENTS: 1,
        MIN_KEY_PRESSES: 1,
        MAX_IDLE_TIME_MS: 60000,      // 1 menit idle = reset
        
        // Session validation
        SESSION_DURATION_MINUTES: 60,
        MAX_SESSIONS_PER_IP: 3,
    };

    // ============ STATE ============
    let blocked = false;
    let blockUntil = 0;
    let requestTimestamps = [];
    let suspiciousCounter = 0;
    let suspiciousResetTimer = null;
    let mouseMovements = 0;
    let scrollEvents = 0;
    let keyPresses = 0;
    let lastActivity = Date.now();
    let sessionStart = Date.now();
    let honeypotTriggered = false;

    // ============ HONEYPOT (Backdoor Trap) ============
    function setupHoneypot() {
        // 1. Hidden field trap (bot akan mengisi field ini)
        const honeypotInput = document.createElement('input');
        honeypotInput.type = 'text';
        honeypotInput.name = 'website';
        honeypotInput.id = 'honeypot_field';
        honeypotInput.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;width:0;';
        honeypotInput.tabIndex = -1;
        honeypotInput.autocomplete = 'off';
        document.body.appendChild(honeypotInput);

        // Monitor jika ada yang ngisi (pasti bot)
        honeypotInput.addEventListener('input', function() {
            if (this.value.length > 0) {
                honeypotTriggered = true;
                console.warn('🛡️ Honeypot triggered! Bot detected.');
                blockUser('honeypot');
            }
        });

        // 2. Hidden link trap
        const honeypotLink = document.createElement('a');
        honeypotLink.href = '/admin';
        honeypotLink.id = 'honeypot_link';
        honeypotLink.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;font-size:1px;';
        honeypotLink.textContent = '.';
        document.body.appendChild(honeypotLink);

        // 3. Console trap (detect automated tools)
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            // Detect jika console dipanggil secara tidak wajar
            const stack = new Error().stack || '';
            if (stack.includes('eval') || stack.includes('Function')) {
                suspiciousCounter += 5;
                checkSuspicious();
            }
            originalConsoleLog.apply(console, args);
        };

        // 4. Detect headless browser
        detectHeadless();
    }

    function detectHeadless() {
        const tests = [];
        
        // Test 1: User Agent
        const ua = navigator.userAgent.toLowerCase();
        if (!ua.includes('mozilla') || ua.includes('headless') || ua.includes('phantom')) {
            tests.push('suspicious-ua');
        }

        // Test 2: WebDriver detection
        if (navigator.webdriver) {
            tests.push('webdriver');
        }

        // Test 3: Plugin detection
        if (navigator.plugins && navigator.plugins.length === 0) {
            tests.push('no-plugins');
        }

        // Test 4: Language detection
        if (!navigator.language || navigator.languages.length === 0) {
            tests.push('no-language');
        }

        // Test 5: Screen dimensions
        if (screen.width === 0 || screen.height === 0) {
            tests.push('no-screen');
        }

        if (tests.length >= 3) {
            console.warn('🛡️ Headless browser detected:', tests);
            suspiciousCounter += 10;
            checkSuspicious();
        }
    }

    // ============ USER ACTIVITY TRACKING ============
    function trackUserActivity() {
        document.addEventListener('mousemove', () => {
            mouseMovements++;
            lastActivity = Date.now();
            resetSuspiciousIfHuman();
        }, { passive: true });

        document.addEventListener('touchmove', () => {
            mouseMovements++;
            lastActivity = Date.now();
            resetSuspiciousIfHuman();
        }, { passive: true });

        document.addEventListener('scroll', () => {
            scrollEvents++;
            lastActivity = Date.now();
            resetSuspiciousIfHuman();
        }, { passive: true });

        document.addEventListener('keydown', () => {
            keyPresses++;
            lastActivity = Date.now();
            resetSuspiciousIfHuman();
        });

        document.addEventListener('click', () => {
            lastActivity = Date.now();
            resetSuspiciousIfHuman();
        });
    }

    function resetSuspiciousIfHuman() {
        if (mouseMovements > SECURITY_CONFIG.MIN_MOUSE_MOVEMENTS && 
            keyPresses > SECURITY_CONFIG.MIN_KEY_PRESSES) {
            suspiciousCounter = Math.max(0, suspiciousCounter - 0.5);
        }
    }

    // ============ SUSPICIOUS ACTIVITY DETECTION ============
    function checkSuspicious() {
        if (suspiciousCounter >= SECURITY_CONFIG.SUSPICIOUS_THRESHOLD) {
            blockUser('suspicious-activity');
        }
        
        // Reset counter setelah window time
        if (suspiciousResetTimer) clearTimeout(suspiciousResetTimer);
        suspiciousResetTimer = setTimeout(() => {
            suspiciousCounter = 0;
        }, SECURITY_CONFIG.SUSPICIOUS_WINDOW_MS);
    }

    function blockUser(reason) {
        blocked = true;
        blockUntil = Date.now() + (SECURITY_CONFIG.BLOCK_DURATION_MINUTES * 60000);
        
        // Tampilkan overlay block
        showBlockOverlay(reason);
        
        // Log ke console (untuk debugging)
        console.error(`🛡️ USER BLOCKED: ${reason}`);
        
        // Simpan ke localStorage
        const blocks = JSON.parse(localStorage.getItem('rexzai_blocks') || '[]');
        blocks.push({ time: Date.now(), reason: reason });
        localStorage.setItem('rexzai_blocks', JSON.stringify(blocks.slice(-10)));
    }

    function showBlockOverlay(reason) {
        const existing = document.getElementById('blockOverlay');
        if (existing) return;

        const overlay = document.createElement('div');
        overlay.id = 'blockOverlay';
        overlay.innerHTML = `
            <style>
                #blockOverlay {
                    position:fixed; inset:0;
                    background:rgba(3,7,18,0.96);
                    z-index:9999;
                    display:flex; align-items:center; justify-content:center;
                    backdrop-filter:blur(20px);
                    padding:20px;
                    animation:blockFadeIn 0.5s ease;
                }
                @keyframes blockFadeIn { from{opacity:0;} to{opacity:1;} }
                .block-card {
                    background:#0f1a2e;
                    border:1px solid #1a2a3f;
                    border-radius:24px;
                    padding:32px 24px;
                    max-width:380px;
                    text-align:center;
                    box-shadow:0 20px 60px rgba(0,0,0,0.6);
                }
                .block-icon {
                    width:64px; height:64px;
                    margin:0 auto 16px;
                    background:rgba(239,68,68,0.1);
                    border-radius:50%;
                    display:flex; align-items:center; justify-content:center;
                    animation:blockPulse 2s ease-in-out infinite;
                }
                @keyframes blockPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.05);} }
                .block-icon svg { width:32px; height:32px; color:#ef4444; }
                .block-title { font-size:20px; font-weight:700; color:#e3e9f2; margin-bottom:8px; }
                .block-desc { font-size:13px; color:#8899b5; line-height:1.6; margin-bottom:20px; }
                .block-timer { font-size:14px; color:#fca5a5; font-weight:600; }
                .block-code { 
                    display:inline-block; background:rgba(239,68,68,0.1);
                    color:#fca5a5; padding:4px 10px; border-radius:6px;
                    font-size:11px; font-family:'JetBrains Mono',monospace;
                    margin-top:8px;
                }
            </style>
            <div class="block-card">
                <div class="block-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <div class="block-title">Akses Dibatasi</div>
                <div class="block-desc">
                    Aktivitas mencurigakan terdeteksi pada koneksi Anda.<br>
                    Akses dibatasi untuk melindungi server dari serangan.
                </div>
                <div class="block-timer" id="blockTimer">Silakan coba lagi nanti.</div>
                <div class="block-code">Kode: ${reason}</div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Update timer
        const timerEl = document.getElementById('blockTimer');
        const updateTimer = setInterval(() => {
            const remaining = Math.max(0, blockUntil - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            
            if (remaining <= 0) {
                clearInterval(updateTimer);
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s ease';
                setTimeout(() => overlay.remove(), 500);
                blocked = false;
                blockUntil = 0;
                suspiciousCounter = 0;
                requestTimestamps = [];
                return;
            }
            
            timerEl.textContent = `Coba lagi dalam ${minutes}m ${seconds}d`;
        }, 1000);
    }

    // ============ RATE LIMITER ============
    function checkRequestLimit() {
        if (blocked) {
            if (Date.now() < blockUntil) {
                return { allowed: false, reason: 'blocked', remaining: Math.ceil((blockUntil - Date.now()) / 1000) };
            } else {
                blocked = false;
                blockUntil = 0;
            }
        }

        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const oneHourAgo = now - 3600000;

        // Clean old timestamps
        requestTimestamps = requestTimestamps.filter(t => t > oneHourAgo);

        // Check per-minute limit
        const requestsLastMinute = requestTimestamps.filter(t => t > oneMinuteAgo).length;
        if (requestsLastMinute >= SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
            suspiciousCounter += 3;
            checkSuspicious();
            return { allowed: false, reason: 'rate-limit-minute' };
        }

        // Check per-hour limit
        const requestsLastHour = requestTimestamps.length;
        if (requestsLastHour >= SECURITY_CONFIG.MAX_REQUESTS_PER_HOUR) {
            suspiciousCounter += 5;
            checkSuspicious();
            return { allowed: false, reason: 'rate-limit-hour' };
        }

        // Check rapid requests (possible DDoS)
        const recentRequests = requestTimestamps.filter(t => t > now - SECURITY_CONFIG.SUSPICIOUS_WINDOW_MS);
        if (recentRequests.length >= SECURITY_CONFIG.SUSPICIOUS_THRESHOLD) {
            suspiciousCounter += 5;
            checkSuspicious();
            return { allowed: false, reason: 'rapid-requests' };
        }

        // Check idle time
        const idleTime = now - lastActivity;
        if (idleTime > SECURITY_CONFIG.MAX_IDLE_TIME_MS) {
            // Reset activity counters
            mouseMovements = 0;
            scrollEvents = 0;
            keyPresses = 0;
        }

        // Check session age
        const sessionAge = now - sessionStart;
        if (sessionAge > SECURITY_CONFIG.SESSION_DURATION_MINUTES * 60000) {
            // Force re-verify
            return { allowed: false, reason: 'session-expired', reauth: true };
        }

        // Verify human activity
        if (mouseMovements < SECURITY_CONFIG.MIN_MOUSE_MOVEMENTS && 
            keyPresses < SECURITY_CONFIG.MIN_KEY_PRESSES &&
            requestsLastHour > 3) {
            return { allowed: false, reason: 'not-human' };
        }

        requestTimestamps.push(now);
        return { allowed: true };
    }

    // ============ INPUT SANITIZER ============
    function sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        let cleaned = input.trim().slice(0, 500);
        
        // Remove HTML tags
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        
        // Remove script patterns
        cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove event handlers
        cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        cleaned = cleaned.replace(/on\w+\s*=\s*\w+/gi, '');
        
        // Remove javascript: protocol
        cleaned = cleaned.replace(/javascript\s*:/gi, '');
        
        // Remove eval/Function
        cleaned = cleaned.replace(/\beval\s*\(/gi, '');
        cleaned = cleaned.replace(/\bFunction\s*\(/gi, '');
        
        // Remove SQL injection patterns
        cleaned = cleaned.replace(/(\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bUPDATE\b)\s+/gi, '');
        cleaned = cleaned.replace(/--/g, '');
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove excessive special characters (possible buffer overflow)
        cleaned = cleaned.replace(/([<>{}[\]\\|`~@#$%^&*]){5,}/g, '');
        
        // Remove null bytes
        cleaned = cleaned.replace(/\0/g, '');
        
        return cleaned;
    }

    function validateInput(input) {
        if (!input || !input.trim()) return false;
        if (input.length > 500) return false;
        
        // Block known attack patterns
        const patterns = [
            /<script/i, /<iframe/i, /<object/i, /<embed/i,
            /eval\(/i, /Function\(/i, /setTimeout\s*\(\s*["']/i,
            /document\.cookie/i, /window\.location/i,
            /onerror\s*=/i, /onload\s*=/i,
            /http:\/\//i, /https:\/\//i, /ftp:\/\//i,
            /\.\.\/\.\.\//i, /\/etc\/passwd/i,
            /%00/, /%3C/, /%3E/,
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(input)) return false;
        }
        
        // Block repetitive characters (spam)
        if (/(.)\1{30,}/.test(input)) return false;
        
        return true;
    }

    // ============ DDOS PROTECTION ============
    function protectDDoS() {
        // Monitor request density
        let requestDensity = 0;
        const densityWindow = 10000; // 10 detik
        
        setInterval(() => {
            const now = Date.now();
            const recentCount = requestTimestamps.filter(t => t > now - densityWindow).length;
            requestDensity = recentCount / (densityWindow / 1000);
            
            // Jika lebih dari 2 request/detik selama 10 detik, anggap DDoS
            if (requestDensity > 2) {
                suspiciousCounter += 8;
                checkSuspicious();
                console.warn('🛡️ High request density detected:', requestDensity.toFixed(2), 'req/s');
            }
        }, densityWindow);
    }

    // ============ GLOBAL ERROR HANDLER ============
    window.addEventListener('error', function(e) {
        if (e.error && e.error.stack) {
            // Detect eval-based attacks
            if (e.error.stack.includes('eval') || e.error.stack.includes('Function')) {
                suspiciousCounter += 5;
                checkSuspicious();
            }
        }
    });

    // Prevent console abuse
    const _originalClear = console.clear;
    console.clear = function() {
        // Bot sering clear console untuk sembunyikan jejak
        suspiciousCounter += 2;
        checkSuspicious();
        _originalClear.apply(console, arguments);
    };

    // ============ EXPORT API ============
    window.RexzSecurity = {
        // Main security check before any action
        secureRequest: function(userMessage) {
            // 1. Check if blocked
            if (blocked && Date.now() < blockUntil) {
                return { 
                    allowed: false, 
                    error: 'BLOCKED',
                    remainingSeconds: Math.ceil((blockUntil - Date.now()) / 1000)
                };
            }
            
            // 2. Check honeypot
            const honeypot = document.getElementById('honeypot_field');
            if (honeypot && honeypot.value.length > 0) {
                blockUser('honeypot-filled');
                return { allowed: false, error: 'BOT_DETECTED' };
            }
            
            // 3. Rate limit check
            const rateCheck = checkRequestLimit();
            if (!rateCheck.allowed) {
                return { allowed: false, error: rateCheck.reason, reauth: rateCheck.reauth };
            }
            
            // 4. Sanitize input
            const cleaned = sanitizeInput(userMessage);
            if (!validateInput(cleaned)) {
                suspiciousCounter += 3;
                checkSuspicious();
                return { allowed: false, error: 'INVALID_INPUT' };
            }
            
            return { allowed: true, cleaned: cleaned };
        },
        
        // Get current security status
        getStatus: function() {
            const now = Date.now();
            const requestsLastMinute = requestTimestamps.filter(t => t > now - 60000).length;
            const requestsLastHour = requestTimestamps.length;
            
            return {
                blocked: blocked,
                blockRemaining: blocked ? Math.ceil((blockUntil - now) / 1000) : 0,
                requestsPerMinute: requestsLastMinute,
                requestsPerHour: requestsLastHour,
                requestsPerDay: JSON.parse(localStorage.getItem('rexzai_daily_usage') || '{"count":0}').count,
                suspiciousScore: Math.round(suspiciousCounter),
                isHuman: mouseMovements > SECURITY_CONFIG.MIN_MOUSE_MOVEMENTS || keyPresses > SECURITY_CONFIG.MIN_KEY_PRESSES,
                honeypotTriggered: honeypotTriggered
            };
        },
        
        // Reset security state
        reset: function() {
            suspiciousCounter = 0;
            requestTimestamps = [];
            blocked = false;
            blockUntil = 0;
        },
        
        // Manual block
        block: function(reason) {
            blockUser(reason || 'manual');
        }
    };

    // ============ INIT ============
    setupHoneypot();
    trackUserActivity();
    protectDDoS();
    
    // Log security status
    console.log('🛡️ RexzSecurity loaded — Anti-Bot | Anti-DDoS | Honeypot Active');
    console.log('🔒 Protection layers:', [
        'Honeypot traps',
        'Rate limiting',
        'DDoS detection',
        'Input sanitization',
        'Headless browser detection',
        'Session validation',
        'User activity tracking'
    ].join(' | '));

})();
