import { VoiceAgent } from '@/components/VoiceAgent';

export default function Home() {
  // API key is now handled server-side in /api/session/gemini
  // Check if it's configured
  const isConfigured = !!process.env.GOOGLE_API_KEY && !!process.env.MONGODB_URI;
  
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Configuration Required</h1>
          <p className="text-gray-400 mb-4">
            Please set the following environment variables:
          </p>
          <ul className="text-left text-sm space-y-2 mb-6">
            <li className="flex items-center gap-2">
              <span className={process.env.GOOGLE_API_KEY ? 'text-green-400' : 'text-red-400'}>
                {process.env.GOOGLE_API_KEY ? '✓' : '✗'}
              </span>
              <code className="bg-gray-800 px-2 py-1 rounded">GOOGLE_API_KEY</code>
            </li>
            <li className="flex items-center gap-2">
              <span className={process.env.MONGODB_URI ? 'text-green-400' : 'text-red-400'}>
                {process.env.MONGODB_URI ? '✓' : '✗'}
              </span>
              <code className="bg-gray-800 px-2 py-1 rounded">MONGODB_URI</code>
            </li>
          </ul>
          <p className="text-sm text-gray-500">
            Create a <code className="bg-gray-800 px-1">.env.local</code> file based on <code className="bg-gray-800 px-1">.env.local.example</code>
          </p>
        </div>
      </div>
    );
  }

  return <VoiceAgent />;
}
