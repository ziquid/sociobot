import { createServer } from "http";
import { ChannelType } from "discord.js";

export function startHttpServer(client, port, log) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/dms') {
      getDMMessages(res, client);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  async function getDMMessages(res, client) {
    try {
      const dmChannels = client.channels.cache.filter(channel => 
        channel.type === ChannelType.DM
      );
      
      const allMessages = [];
      
      for (const [channelId, channel] of dmChannels) {
        const messages = await channel.messages.fetch({ limit: 10 });
        messages.forEach(msg => {
          allMessages.push({
            timestamp: msg.createdAt.toLocaleString('en-US'),
            author: msg.author.username,
            recipient: channel.recipient.username,
            content: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '')
          });
        });
      }
      
      // Sort by timestamp (most recent first)
      allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ messages: allMessages.slice(0, 20) }, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  server.listen(port, '127.0.0.1', 5, () => {
    log(`DM monitoring server listening on port ${port}`);
  });
}