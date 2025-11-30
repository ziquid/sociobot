export function setupErrorHandlers(client, log) {
  // Enhanced Discord client error handling
  client.on('error', (error) => {
    log('Discord client error:', error);
  });

  client.on('warn', (warning) => {
    log('Discord client warning:', warning);
  });

  client.on('disconnect', (event) => {
    log('Discord client disconnected:', event);
  });

  client.on('reconnecting', () => {
    log('Discord client reconnecting...');
  });

  client.on('resume', (replayed) => {
    log(`Discord client resumed, replayed ${replayed} events`);
  });

  // Enhanced process error handling
  process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled promise rejection:', { reason, promise });
    console.error('UNHANDLED PROMISE REJECTION - This may cause the bot to crash!');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
  });

  process.on('uncaughtException', (error) => {
    log('Uncaught exception:', error);
    console.error('UNCAUGHT EXCEPTION - Bot will likely crash!');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    // Try to gracefully shutdown
    try {
      client.destroy();
    } catch (e) {
      console.error('Error during graceful shutdown:', e);
    }
    
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
  });
}