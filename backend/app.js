import express from 'express';
import cors from 'cors';
import executarController from './controllers/executarController.js';
const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.get('/health', (_req, res) => res.json({ sucesso: true }));
app.post('/executar', executarController.executar);
app.post('/traduzir', executarController.traduzir);
app.use((error, _req, res, _next) => {
  res.status(error.status === 413 ? 413 : 400).json({ sucesso: false, erro: error.status === 413 ? 'Requisição muito grande.' : 'JSON inválido.' });
});
export default app;
