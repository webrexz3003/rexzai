// ============================================================
//  REXZAI CONFIG — JANGAN UPLOAD KE GITHUB!
//  File ini di .gitignore
// ============================================================

const CONFIG = {
    // API Key OpenRouter
    OPENROUTER_API_KEY: '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',
    
    // App info
    APP_NAME: 'RexzAI',
    APP_URL: 'https://rexzai.app',
    
    // Model config (default)
    get MODEL() { return window._currentModel || 'nvidia/nemotron-3-ultra-550b-a55b:free'; },
    MAX_TOKENS: 150,
    TEMPERATURE: 0.4,
    TOP_P: 0.8,
    MAX_HISTORY: 3,
    
    // Security
    MAX_REQUESTS_PER_MINUTE: 15,  // Maksimal 15 request/menit
    COOLDOWN_SECONDS: 20,          // Cooldown 20 detik kalau kena limit
    REQUEST_DELAY_MS: 2000,        // Delay 2 detik antar request
    MAX_MESSAGE_LENGTH: 500,       // Maksimal panjang pesan
    
    SYSTEM_PROMPT: `Kamu RexzAI. Jawab SINGKAT 1-3 kalimat dalam Bahasa Indonesia. Langsung ke inti, tanpa basa-basi.`
};
