import express from 'express';
import cors from 'cors';
import session from 'express-session';
import morgan from 'morgan';
import { apiRouter } from './routes/api.routes.js';
import { serverConfig } from './config/env.js';

const app = express();

app.use(cors({ origin: serverConfig.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(session({
  name: 'gopay_console.sid',
  secret: serverConfig.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  },
}));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
});

app.listen(serverConfig.port, () => {
  console.log(`GoPay Test Console backend listening on http://localhost:${serverConfig.port}`);
});
