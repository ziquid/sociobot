/**
 * @fileoverview Discord message utilities for splitting and sending long messages
 * Handles message chunking, embed creation, and ACL (Agent Chain Length) tracking
 */

import { EmbedBuilder } from 'discord.js';
import { createFooter, getACL, getMaxACL, hasParticipatedInThread } from './metadata.js';

/** @constant {number} Maximum characters allowed in a Discord message */
const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Strip <think></think> tags and their content from a message
 * @param {string} content - The message content to clean
 * @returns {string} Message with think tags removed
 */
export function stripThinkTags(content) {
  // Remove <think>...</think> tags and their content (non-greedy match)
  // This handles both single-line and multi-line think blocks
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Handle malformed cases: content before a closing tag (missing opening tag)
  // Remove everything from start of string up to and including </think>
  result = result.replace(/^[\s\S]*?<\/think>\s*/gi, '');

  // Also strip any orphaned opening or closing tags
  result = result.replace(/<\/?think>/gi, '');

  return result.trim();
}

/**
 * Split a long message into chunks that fit within Discord's character limit
 * @param {string} content - The message content to split
 * @returns {string[]} Array of message chunks, each under the Discord limit
 * @example
 * const chunks = splitMessage(longText);
 * chunks.forEach((chunk, i) => console.log(`Chunk ${i + 1}: ${chunk}`));
 */
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

/**
 * Send a long message as a reply, splitting into chunks if needed and adding ACL footer
 * @param {Object} message - The original Discord message object we're replying to
 * @param {string} content - The response content string to send
 * @param {boolean} debug - Enable debug logging
 * @param {string|null} audioPath - Optional path to audio file to attach to first message
 * @returns {Promise<void>}
 */
export async function sendLongMessage(message, content, debug = false, audioPath = null) {
  // Strip <think></think> tags before processing
  const cleanedContent = stripThinkTags(content);

  // Calculate ACL for this response
  const acl = getACL(message);
  const maxACL = getMaxACL(message.channel, debug);

  // Check if this agent has participated in the thread
  const botUserId = message.client.user.id;
  const hasParticipated = await hasParticipatedInThread(message, botUserId);

  // Double ACL limit if agent participated in thread
  const effectiveMaxACL = hasParticipated ? maxACL * 2 : maxACL;

  // Block sending if ACL would exceed maximum
  if (acl >= effectiveMaxACL) {
    throw new Error(`ACL limit reached (${effectiveMaxACL})`);
  }

  const chunks = splitMessage(cleanedContent);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';

    try {
      if (i === 0) {
        const embed = new EmbedBuilder()
          .setDescription('\u200B')
          .setFooter({ text: createFooter(acl + 1) });

        const messageOptions = {
          content: prefix + chunk,
          embeds: [embed]
        };

        // Attach audio file if provided
        if (audioPath) {
          messageOptions.files = [{ attachment: audioPath }];
        }

        await message.reply(messageOptions);
      } else {
        await message.reply(prefix + chunk);
      }
    } catch (error) {
      throw new Error(`Failed to send message chunk ${i + 1}: ${error.message}`);
    }
  }
}

/**
 * Send a message to a channel with ACL footer
 * @param {Object} channel - Discord channel object to send to
 * @param {string} content - The message content to send
 * @param {number} acl -- ACL value to use (default: 1)
 * @returns {Promise<void>}
 */
export async function sendChannelMessage(channel, content, acl = 1) {
  // Strip <think></think> tags before processing
  const cleanedContent = stripThinkTags(content);
  const chunks = splitMessage(cleanedContent);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';

    const embed = new EmbedBuilder()
      .setDescription('\u200B')
      .setFooter({ text: createFooter(acl) });

    await channel.send({
      content: prefix + chunk,
      embeds: [embed]
    });
  }
}

/**
 * Send a webhook message with ACL footer
 * @param {Object} webhook - Discord webhook object
 * @param {string} content - The message content to send
 * @param {number} acl -- ACL value to use (default: 1)
 * @param {string|null} username -- Optional username to display
 * @param {string|null} avatarURL -- Optional avatar URL to display (shows headshot)
 * @returns {Promise<void>}
 */
export async function sendWebhookMessage(webhook, content, acl = 1, username = null, avatarURL = null) {
  // Strip <think></think> tags before processing
  const cleanedContent = stripThinkTags(content);
  const chunks = splitMessage(cleanedContent);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';

    const embed = new EmbedBuilder()
      .setDescription('\u200B')
      .setFooter({ text: createFooter(acl) });

    const messageOptions = {
      content: prefix + chunk,
      embeds: [embed]
    };

    // Add username and avatar if provided (shows headshot)
    if (username) {
      messageOptions.username = username;
    }
    if (avatarURL) {
      messageOptions.avatarURL = avatarURL;
    }

    await webhook.send(messageOptions);
  }
}
