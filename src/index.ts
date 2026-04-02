import 'dotenv/config';
import express from 'express';
import subjectRouter from './routes/subjects.js'; // Import router Anda
import cors from 'cors'
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';

const app = express();
app.set('trust proxy', 1); // Document/configure trust proxy for rate limiter req.ip
const PORT = 8000;

// Validate FRONTEND_URL
const frontendUrl = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!frontendUrl && isProduction) {
  throw new Error('CORS Error: FRONTEND_URL is not defined in production environment.');
}

app.use(express.json());


app.use(cors({
  origin: frontendUrl || false, // Explicitly set to false if undefined to prevent reflecting request origins
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}))

app.all('/api/auth/{*any}', toNodeHandler(auth));

app.use(securityMiddleware);

app.use('/api/subjects', subjectRouter);

app.get('/', (req, res) => {
  res.send('API Classroom is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
