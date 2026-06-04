import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import executeRoutes from './routes/execute.routes.js';
import fileRoutes from './routes/file.routes.js';
import githubRoutes from './routes/github.routes.js';
import projectRoutes from './routes/project.routes.js';
import roomRoutes from './routes/room.routes.js';
import sandboxRoutes from './routes/sandbox.routes.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CodeSync API is healthy'
  });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/github', githubRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
