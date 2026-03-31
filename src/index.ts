// src/index.ts
import express from 'express';
import subjectRouter from './routes/subjects.js'; // Import router Anda
import cors from 'cors'

const app = express();
const PORT = 8000;

app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL,
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
