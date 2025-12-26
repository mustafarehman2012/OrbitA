import { useState, useRef } from 'react';
import { Download, Volume2, VolumeX, Link2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// BACKEND API CONFIGURATION
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.29.14:3001'; // Change this to your deployed backend URL

const OrbitApp = () => {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [videoData, setVideoData] = useState<any>(null);
  const [error, setError] = useState('');
  const [muteAudio, setMuteAudio] = useState(false);
  const [adCompleted, setAdCompleted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [extractionStage, setExtractionStage] = useState('');
  const inputRef = useRef(null);

  // Simulated Ad Integration (Replace with real AdSense)
  const triggerRewardedAd = () => {
    setShowAdModal(true);
    // Simulate ad completion after 3 seconds
    setTimeout(() => {
      setAdCompleted(true);
      setShowAdModal(false);
    }, 3000);
  };

  // Clipboard API Integration
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setError('');
      }
    } catch (err) {
      setError('Clipboard access denied. Please paste manually.');
    }
  };

  // Real Backend Extraction
  const extractVideoData = async (videoUrl: string) => {
    setExtractionStage('Connecting to server...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract video');
      }

      setExtractionStage('Extracting video data...');
      const data = await response.json();
      
      setExtractionStage('Complete!');
      
      return {
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        size: data.size,
        format: data.format,
        author: data.author,
        platform: data.platform,
        downloadUrl: data.originalUrl || videoUrl,
        directLinks: data.directLinks
      };
    } catch (err) {
      const error = err as Error;
      throw new Error(error.message || 'Could not extract video. Please check the URL and try again.');
    }
  };

  const handleOrbitClick = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    // Basic URL validation
    const urlPattern = /^(https?:\/\/)?([\w\d-]+\.)+[\w\d-]+(\/.*)?$/;
    if (!urlPattern.test(url)) {
      setError('Invalid URL format');
      return;
    }

    setProcessing(true);
    setError('');
    setVideoData(null);
    setAdCompleted(false);
    setExtractionStage('Starting...');

    try {
      const data = await extractVideoData(url);
      setVideoData(data);
      setProcessing(false);
      setExtractionStage('');
      
      // Trigger ad after successful extraction
      triggerRewardedAd();
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to extract video. Please check the URL.');
      setProcessing(false);
      setExtractionStage('');
    }
  };

  const handleDownload = async (quality = 'best') => {
    if (!adCompleted) {
      setError('Please complete the ad to download');
      return;
    }

    setDownloading(true);
    setError('');

    try {
      // Get format ID for selected quality
      let formatId = quality === 'best' ? null : videoData.directLinks[quality];
      
      if (!formatId && quality !== 'best') {
        // Fallback to best quality if selected quality not available
        formatId = null;
      }

      const response = await fetch(`${API_BASE_URL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoData.downloadUrl,
          formatId: formatId,
          muteAudio: muteAudio && quality !== 'audio'
        })
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get blob and trigger download
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${videoData.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      
      setDownloading(false);
      
      // Show success message
      setTimeout(() => {
        alert('Download started! Check your downloads folder.');
      }, 500);
      
    } catch (err) {
      const error = err as Error;
      setError('Download failed: ' + error.message);
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 py-4 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-xl font-bold">O</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Orbit
          </span>
        </div>
        <div className="flex gap-4 text-sm">
          <a href="#" className="hover:text-purple-400 transition-colors">About</a>
          <a href="#" className="hover:text-purple-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-purple-400 transition-colors">Terms</a>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Welcome to Orbit
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Preview & Download Social Media Videos
          </p>
          <p className="text-sm text-gray-400">
            Extract videos from 1000+ platforms with audio control
          </p>
        </div>

        {/* Main Input Area */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-xl animate-pulse"></div>
          
          <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-3xl p-8 border border-purple-500/30">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleOrbitClick()}
                  placeholder="Paste your video URL here..."
                  className="w-full px-6 py-4 bg-gray-900/50 border border-purple-500/30 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                />
                <Link2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              </div>
              
              <button
                onClick={handlePaste}
                className="px-6 py-4 bg-gray-700/50 hover:bg-gray-700 rounded-2xl transition-all border border-purple-500/30"
              >
                Paste
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-900/20 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {extractionStage && (
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-4 bg-blue-900/20 p-3 rounded-lg">
                <Loader2 className="animate-spin" size={16} />
                {extractionStage}
              </div>
            )}

            <button
              onClick={handleOrbitClick}
              disabled={processing}
              className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Extracting Video...
                </>
              ) : (
                <>
                  <span className="text-2xl">🌀</span>
                  Launch into Orbit
                </>
              )}
            </button>
          </div>
        </div>

        {/* Video Preview Card */}
        {videoData && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl p-8 border border-purple-500/30">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <CheckCircle className="text-green-400" size={28} />
              Video Ready
            </h3>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="relative rounded-2xl overflow-hidden">
                <img 
                  src={videoData.thumbnail} 
                  alt="Video thumbnail"
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/640x360/1a1a2e/00ff88?text=Video+Preview';
                  }}
                />
                <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs">
                  {videoData.duration}
                </div>
                {videoData.platform && (
                  <div className="absolute top-2 left-2 bg-purple-600 px-2 py-1 rounded text-xs uppercase font-bold">
                    {videoData.platform}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-300 mb-2">{videoData.title}</h4>
                  {videoData.author && (
                    <p className="text-sm text-gray-400">By: {videoData.author}</p>
                  )}
                  <p className="text-sm text-gray-400">Format: {videoData.format}</p>
                  <p className="text-sm text-gray-400">Size: {videoData.size}</p>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-xl">
                  <button
                    onClick={() => setMuteAudio(!muteAudio)}
                    className="p-2 bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors"
                  >
                    {muteAudio ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <div>
                    <p className="text-sm font-semibold">Audio Control</p>
                    <p className="text-xs text-gray-400">
                      {muteAudio ? 'Audio will be removed' : 'Audio included'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Download Quality Options */}
            {adCompleted && videoData.directLinks && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-300 mb-3">Select Quality:</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(videoData.directLinks).map(([quality, formatId]) => 
                    formatId ? (
                      <button
                        key={quality}
                        onClick={() => handleDownload(quality)}
                        disabled={downloading}
                        className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {quality}
                      </button>
                    ) : null
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => handleDownload('best')}
              disabled={!adCompleted || downloading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 rounded-2xl font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={20} />
                  {adCompleted ? 'Download Best Quality' : 'Complete Ad to Download'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Backend Status Indicator */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 text-center">
          <p className="text-sm text-blue-300">
            🔗 Backend API: <span className="font-mono">{API_BASE_URL}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Make sure your backend server is running on this URL
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-3xl mb-3">🎬</div>
            <h4 className="font-bold mb-2">1000+ Platforms</h4>
            <p className="text-sm text-gray-400">
              Powered by yt-dlp for maximum compatibility
            </p>
          </div>
          
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-3xl mb-3">🎵</div>
            <h4 className="font-bold mb-2">Audio Control</h4>
            <p className="text-sm text-gray-400">
              Download with or without audio track
            </p>
          </div>
          
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-3xl mb-3">⚡</div>
            <h4 className="font-bold mb-2">Fast & Free</h4>
            <p className="text-sm text-gray-400">
              Watch a brief ad for instant access
            </p>
          </div>
        </div>
      </div>

      {/* Ad Modal */}
      {showAdModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-3xl p-8 max-w-md w-full border border-purple-500/30">
            <h3 className="text-2xl font-bold mb-4 text-center">
              Your video is ready!
            </h3>
            <p className="text-gray-300 mb-6 text-center">
              Watch a brief ad to start your high-speed download
            </p>
            
            <div className="bg-gray-900 rounded-2xl p-8 mb-6 flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <Loader2 className="animate-spin mx-auto mb-4 text-purple-400" size={48} />
                <p className="text-sm text-gray-400">Ad playing...</p>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 text-center">
              This supports free access to Orbit
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-purple-500/20 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <p className="mb-2">© 2024 Orbit. All rights reserved.</p>
          <p className="text-xs">
            This tool is for personal use only. Respect copyright and platform terms.
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <a href="#" className="hover:text-purple-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-purple-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-purple-400 transition-colors">DMCA</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OrbitApp;