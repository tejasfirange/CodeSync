import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { setupSocketServer } from './sockets/socket.server.js';

const httpServer = http.createServer(app);
const io = setupSocketServer(httpServer);
app.set('io', io);

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(env.port, () => {
      console.log(`CodeSync API listening on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing HTTP server.');
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  httpServer.close(() => {
    process.exit(1);
  });
});
