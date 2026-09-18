const express = require('express');
const seo = require('../services/seo.service');

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await seo.getSitemapXml();
    res.type('application/xml').send(xml);
  } catch (err) {
    console.error('[sitemap] failed:', err.message);
    res.status(500).type('text/plain').send('sitemap temporarily unavailable');
  }
});

router.get('/robots.txt', async (req, res) => {
  try {
    const txt = await seo.getRobotsTxt();
    res.type('text/plain').send(txt);
  } catch (err) {
    console.error('[robots] failed:', err.message);
    res.type('text/plain').send('User-agent: *\nAllow: /\n');
  }
});

module.exports = router;
