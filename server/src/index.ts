import express from 'express'
import cors from 'cors'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'tistory-api' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'tistory-api' }))

app.listen(port, '0.0.0.0', () => console.log(`tistory-api listening on ${port}`))
