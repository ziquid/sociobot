const DISCORD_MESSAGE_LIMIT = 2000;

export function splitMessage(content) {
  if (content.length <= DISCORD_MESSAGE_LIMIT) {
    return [content];
  }

  const chunks = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MESSAGE_LIMIT) {
      chunks.push(remaining);
      break;
    }

    // Find the best split point within the limit
    let splitIndex = DISCORD_MESSAGE_LIMIT;
    
    // Try to split at a paragraph break first
    const paragraphBreak = remaining.lastIndexOf('\n\n', DISCORD_MESSAGE_LIMIT);
    if (paragraphBreak > DISCORD_MESSAGE_LIMIT * 0.5) {
      splitIndex = paragraphBreak + 2;
    } else {
      // Try to split at a line break
      const lineBreak = remaining.lastIndexOf('\n', DISCORD_MESSAGE_LIMIT);
      if (lineBreak > DISCORD_MESSAGE_LIMIT * 0.7) {
        splitIndex = lineBreak + 1;
      } else {
        // Try to split at a sentence end
        const sentenceEnd = remaining.lastIndexOf('. ', DISCORD_MESSAGE_LIMIT);
        if (sentenceEnd > DISCORD_MESSAGE_LIMIT * 0.7) {
          splitIndex = sentenceEnd + 2;
        } else {
          // Try to split at a word boundary
          const wordBoundary = remaining.lastIndexOf(' ', DISCORD_MESSAGE_LIMIT);
          if (wordBoundary > DISCORD_MESSAGE_LIMIT * 0.8) {
            splitIndex = wordBoundary + 1;
          }
          // Otherwise use hard limit
        }
      }
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex);
  }

  return chunks;
}

export async function sendLongMessage(message, content) {
  const chunks = splitMessage(content);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';
    
    try {
      // await message.channel.send(prefix + chunk);
      await message.reply(prefix + chunk);
    } catch (error) {
      throw new Error(`Failed to send message chunk ${i + 1}: ${error.message}`);
    }
  }
}