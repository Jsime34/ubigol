import express, { Request, Response } from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Ubigol Backend API - Online ⚽');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Ubigol corriendo en http://localhost:${PORT}`);
});