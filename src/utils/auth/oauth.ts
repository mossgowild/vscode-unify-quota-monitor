/* eslint-disable @typescript-eslint/naming-convention */
import * as http from 'node:http'
import * as crypto from 'node:crypto'

export function generateRandomString(length: number): string {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let out = ''
  const bytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i] % charset.length]
  }
  return out
}

export function generatePkce() {
  const verifier = generateRandomString(43)
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return { verifier, challenge }
}

export async function waitForOAuthCallback(
  port: number,
  path: string,
  state: string
): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`)
      
      if (url.pathname !== path) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }

      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')

      if (returnedState !== state) {
        res.end('Invalid state. Please try again.')
        server.close()
        resolve(null)
        return
      }

      if (code) {
        res.end('Authentication successful!')
        server.close()
        resolve(code)
      }
    })

    server.on('error', () => {
      server.close()
      resolve(null)
    })

    server.listen(port)
  })
}
