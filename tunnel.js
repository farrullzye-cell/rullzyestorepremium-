const localtunnel = require('localtunnel');

(async () => {
    try {
        const tunnel = await localtunnel({ 
            port: 3000, 
            subdomain: 'rullzyepremiumstore' // Nama link permanen kamu
        });

        console.log('✅ BERHASIL! Localtunnel aktif.');
        console.log(`🚀 Link Permanen kamu: ${tunnel.url}`);

        tunnel.on('close', () => {
            console.log('❌ Tunnel terputus');
        });
    } catch (err) {
        console.error('Gagal membuat tunnel:', err);
    }
})();
