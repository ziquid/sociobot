/**
 * @fileoverview System utilities for Discord bot
 * Handles system monitoring and resource management
 */

import { execSync } from 'child_process';

/**
 * Check system load average and exit if too high
 * @param {number} maxLoadAverage - Maximum allowed load average
 * @param {Function} logFn - Logging function
 * @example
 * checkLoadAverage(21, console.log);
 */
export function checkLoadAverage(maxLoadAverage, logFn) {
  try {
    const uptime = execSync('uptime').toString();
    const loadMatch = uptime.match(/load averages?: ([\d.]+)/);
    if (loadMatch) {
      const load = parseFloat(loadMatch[1]);
      if (load > maxLoadAverage) {
        logFn(`HIGH LOAD DETECTED: ${load} - exiting to reduce system load`);
        process.exit(1);
      }
    }
  } catch (error) {
    logFn(`Load check failed: ${error.message}`);
  }
}