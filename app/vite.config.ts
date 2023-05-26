import { UserConfigExport } from 'vite'
import path from 'path'
import devsert from 'devcert'

export default async (): Promise<UserConfigExport> => {
  const { key, cert } = await devsert.certificateFor('localhost')
  return {
    resolve: {
      alias: {
        '@/': path.join(__dirname, './src/'),
      },
    },
    server: {
      host: '0.0.0.0',
      open: true,
      https: {
        key,
        cert
      }
    }
  }  
}
