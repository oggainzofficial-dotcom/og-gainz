require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db.config');
const { ENV } = require('./config/env.config');
const logger = require('./utils/logger.util');
const mongoose = require('mongoose');

const startServer = async () => {
  console.log('Loaded URI:', process.env.MONGODB_URI || process.env.MONGO_URI);
  await connectDB();

  if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
    logger.warn('Razorpay env missing: payment verification/checkout may fail (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)');
  }

  if (!ENV.RAZORPAY_WEBHOOK_SECRET) {
    logger.warn('Razorpay webhook secret missing: orders may remain pending_payment (RAZORPAY_WEBHOOK_SECRET)');
  }

  const port = Number(ENV.SERVER_PORT);
  const server = app.listen(port, () => {
    logger.info('🚀 OG Gainz Server started');
    logger.info(`📍 Environment: ${ENV.NODE_ENV}`);
    logger.info(`🔌 Listening on port: ${port}`);
  });

  const shutdown = async (signal) => {
    logger.info(`👋 ${signal} RECEIVED. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await mongoose.connection.close(false);
      } catch (err) {
        logger.error('Error closing MongoDB connection:', err);
      }
      logger.info('✅ Shutdown complete');
      process.exit(0);
    });

    // Force shutdown if the server doesn't close in time
    setTimeout(() => {
      logger.error('⏱️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('💥 UNHANDLED REJECTION! Shutting down...');
    logger.error(err);
    shutdown('unhandledRejection');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
    logger.error(err);
    process.exit(1);
  });
};

startServer();
