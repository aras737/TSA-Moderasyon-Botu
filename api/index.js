module.exports = (req, res) => {
    res.status(200).json({
        ok: true,
        service: 'TSA Moderasyon Botu',
        message: 'Vercel web endpoint aktif. Discord botu 7/24 calistirmak icin Render/Railway gibi worker destekli host kullan.'
    });
};
