import express from 'express'
import cors from 'cors'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'moa-api' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'moa-api' }))

app.listen(port, '0.0.0.0', () => console.log(`moa-api listening on ${port}`))
