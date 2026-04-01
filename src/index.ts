import 'dotenv/config';
import express from 'express';
import subjectRouter from './routes/subjects.js'; // Import router Anda
import cors from 'cors'
import securityMiddleware from './middleware/security.js';

const app = express();
const PORT = 8000;

// Validate FRONTEND_URL
const frontendUrl = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!frontendUrl && isProduction) {
  throw new Error('CORS Error: FRONTEND_URL is not defined in production environment.');
}

app.use(express.json());

app.use(securityMiddleware);

app.use(cors({
  origin: frontendUrl || false, // Explicitly set to false if undefined to prevent reflecting request origins
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}))

app.use('/api/subjects', subjectRouter);

app.get('/', (req, res) => {
  res.send('API Classroom is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
