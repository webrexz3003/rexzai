// ============================================================
//  REXZAI SECURITY — Anti-Bot, Rate Limiter, DDoS Protection
// ============================================================

(function() {
    'use strict';

    // ============ RATE LIMITER ============
    const RateLimiter = {
        requests: [],
        maxRequests: CONFIG.MAX_REQUESTS_PER_MINUTE || 15,
        windowMs: 60000, // 1 menit
        cooldownSeconds: CONFIG.COOLDOWN_SECONDS || 20,
        isCooldown: false,
        cooldownEnd: 0,

        check: function() {
            const now = Date.now();
            
            // Clear old requests
            this.requests = this.requests.filter(t => now - t < this.windowMs);
            
            // Check cooldown
            if (this.isCooldown) {
                if (now < this.cooldownEnd) {
                    const remaining = Math.ceil((this.cooldownEnd - now) / 1000);
                    throw new Error(`RATE_LIMIT_COOLDOWN:${remaining}`);
                } else {
                    this.isCooldown = false;
                    this.requests = [];
                }
            }
            
            // Check request count
            if (this.requests.length >= this.maxRequests) {
                this.isCooldown = true;
                this.cooldownEnd = now + (this.cooldownSeconds * 1000);
                throw new Error(`RATE_LIMIT:${this.cooldownSeconds}`);
            }
            
            this.requests.push(now);
            return true;
        },

        getRemaining: function() {
            const now = Date.now();
            this.requests = this.requests.filter(t => now - t < this.windowMs);
            return this.maxRequests - this.requests.length;
        },

        reset: function() {
            this.requests = [];
            this.isCooldown = false;
            this.cooldownEnd = 0;
        }
    };

    // ============ INPUT SANITIZER ============
    const Sanitizer = {
        maxLength: CONFIG.MAX_MESSAGE_LENGTH || 500,
        
        clean: function(input) {
            if (typeof input !== 'string') return '';
            
            // Trim & limit length
            let cleaned = input.trim().slice(0, this.maxLength);
            
            // Remove HTML tags
            cleaned = cleaned.replace(/<[^>]*>/g, '');
            
            // Remove script injections
            cleaned = cleaned.replace(/javascript:/gi, '');
            cleaned = cleaned.replace(/on\w+\s*=/gi, '');
            
            // Remove excessive special chars
            cleaned = cleaned.replace(/(.)\1{10,}/g, '$1$1$1');
            
            return cleaned;
        },
        
        validate: function(input) {
            // Block empty
            if (!input || !input.trim()) return false;
            
            // Block excessive repetition (bot spam)
            const repeated = input.match(/(.)\1{20,}/);
            if (repeated) return false;
            
            // Block known attack patterns
            const attackPatterns = [
                /<script/i,
                /<iframe/i,
                /eval\(/i,
                /document\.cookie/i,
                /window\.location/i,
                /onerror\s*=/i,
                /onload\s*=/i,
            ];
            
            for (const pattern of attackPatterns) {
                if (pattern.test(input)) return false;
            }
            
            return true;
        }
    };

    // ============ BOT DETECTOR ============
    const BotDetector = {
        mouseMovements: 0,
        keyPresses: 0,
        lastActivity: Date.now(),
        isHuman: false,
        
        init: function() {
            // Track mouse movement
            document.addEventListener('mousemove', () => {
                this.mouseMovements++;
                this.lastActivity = Date.now();
                this.checkHuman();
            }, { passive: true });
            
            // Track touch
            document.addEventListener('touchmove', () => {
                this.mouseMovements++;
                this.lastActivity = Date.now();
                this.checkHuman();
            }, { passive: true });
            
            // Track keyboard
            document.addEventListener('keydown', () => {
                this.keyPresses++;
                this.lastActivity = Date.now();
                this.checkHuman();
            });
            
            // Track scroll
            document.addEventListener('scroll', () => {
                this.lastActivity = Date.now();
                this.checkHuman();
            }, { passive: true });
            
            // Check after 3 seconds
            setTimeout(() => this.checkHuman(), 3000);
        },
        
        checkHuman: function() {
            if (this.mouseMovements > 2 || this.keyPresses > 0) {
                this.isHuman = true;
            }
        },
        
        verify: function() {
            // Always allow if tutorial is active
            if (document.getElementById('tutorialOverlay')) return true;
            
            // Check activity
            const idleTime = Date.now() - this.lastActivity;
            if (idleTime > 300000) { // 5 menit idle
                RateLimiter.reset();
            }
            
            return this.isHuman || this.keyPresses > 0;
        }
    };

    // ============ REQUEST QUEUE ============
    const RequestQueue = {
        lastRequestTime: 0,
        minDelay: CONFIG.REQUEST_DELAY_MS || 2000,
        
        async wait() {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            
            if (timeSinceLastRequest < this.minDelay) {
                const waitTime = this.minDelay - timeSinceLastRequest;
                await new Promise(r => setTimeout(r, waitTime));
            }
            
            this.lastRequestTime = Date.now();
        }
    };

    // ============ EXPORT TO GLOBAL ============
    window.RexzSecurity = {
        RateLimiter,
        Sanitizer,
        BotDetector,
        RequestQueue,
        
        // Main security check before API call
        async secureCall(userMessage) {
            // 1. Verify human
            if (!BotDetector.verify()) {
                throw new Error('SECURITY: Verifikasi pengguna gagal.');
            }
            
            // 2. Sanitize input
            const cleaned = Sanitizer.clean(userMessage);
            if (!Sanitizer.validate(cleaned)) {
                throw new Error('SECURITY: Input tidak valid.');
            }
            
            // 3. Rate limit check
            RateLimiter.check();
            
            // 4. Queue delay
            await RequestQueue.wait();
            
            return cleaned;
        },
        
        getRateLimitInfo() {
            return {
                remaining: RateLimiter.getRemaining(),
                max: CONFIG.MAX_REQUESTS_PER_MINUTE,
                cooldown: RateLimiter.isCooldown,
                cooldownRemaining: RateLimiter.isCooldown ? 
                    Math.ceil((RateLimiter.cooldownEnd - Date.now()) / 1000) : 0
            };
        }
    };

    // Init bot detector
    BotDetector.init();
    
    console.log('🛡️ RexzSecurity loaded');
})();
