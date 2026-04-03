import AgentAPI from 'apminsight';
AgentAPI.config();

import 'dotenv/config';
import express from 'express';
import subjectRouter from './routes/subjects.js';
import classesRouter from './routes/classes.js';
import cors from 'cors'
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import userRoles from './routes/users.js';

const app = express();
app.set('trust proxy', 1);
const PORT = 8000;

// Validate FRONTEND_URL
const frontendUrl = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!frontendUrl && isProduction) {
  throw new Error('CORS Error: FRONTEND_URL is not defined in production environment.');
}

app.use(express.json());


app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (origin.includes("localhost")) {
      return callback(null, true);
    }

    if (origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}))

app.all('/api/auth/{*any}', toNodeHandler(auth));

app.use(securityMiddleware);

app.use('/api/subjects', subjectRouter);
app.use('/api/classes', classesRouter);
app.use('/api/users', userRoles)

app.get('/', (req, res) => {
  res.send('API Classroom is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
