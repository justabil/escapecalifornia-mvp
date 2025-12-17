const fetch = require('node-fetch');
const xml2js = require('xml2js');

const CALMATTERS_FEED_URL = 'https://calmatters.org/feed/';

// Simple in-memory cache to avoid hammering their server
let cachedItems = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchCalMattersFeed() {
  // Return cached if fresh
  const now = Date.now();
  if (cachedItems && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedItems;
  }

  try {
    const response = await fetch(CALMATTERS_FEED_URL, {
      headers: {
        'User-Agent': 'EscapeCalifornia-MVP/1.0 (+https://escapecalifornia.com)'
      }
    });

    if (!response.ok) {
      console.error('CalMatters RSS fetch failed:', response.status, response.statusText);
      return [];
    }

    const xml = await response.text();

    const parsed = await xml2js.parseStringPromise(xml, { trim: true });
    const channel = parsed.rss && parsed.rss.channel && parsed.rss.channel[0];
    if (!channel || !channel.item) {
      console.warn('CalMatters RSS has no channel items');
      return [];
    }

    const items = channel.item.map(item => {
      const title = (item.title && item.title[0]) || 'Untitled';
      const link = (item.link && item.link[0]) || null;
      const pubDate = (item.pubDate && item.pubDate[0]) || null;
      const source = 'CalMatters';

      return {
        title,
        url: link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : null
      };
    });

    // Cache and return
    cachedItems = items;
    cacheTimestamp = now;
    return items;
  } catch (err) {
    console.error('Error fetching/parsing CalMatters RSS:', err);
    return [];
  }
}

module.exports = {
  fetchCalMattersFeed
};
