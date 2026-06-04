// ── Server bootstrap ──
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env before anything else — explicit path to project root
const require = createRequire(import.meta.url)
const dotenv = require('dotenv')
dotenv.config({ path: join(__dirname, '../.env') })

// Verify key loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in .env')
  process.exit(1)
}
console.log('API key loaded:', process.env.ANTHROPIC_API_KEY.slice(0, 12) + '…')

import app from './app.js'

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})