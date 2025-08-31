import ngrok from 'ngrok';

// Start ngrok
export async function startNgrok(port = 3000) {
  try {
    // If ngrok is already running, try to get its URL
    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels');
      const data = await response.json();
      if (data.tunnels && data.tunnels.length > 0) {
        const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
        if (httpsTunnel) {
          console.log('Using existing ngrok tunnel:', httpsTunnel.public_url);
          return httpsTunnel.public_url;
        }
      }
    } catch (error) {
      console.log('No existing ngrok tunnel found, starting new one');
    }

    // If no existing tunnel, start a new one with proper configuration
    try {
      const url = await ngrok.connect({
        addr: port,
        proto: 'http',
        authtoken: process.env.NGROK_AUTHTOKEN || '2wcciWfs77HIGrfvoevL47MGqHE_42p2fUVB9sGh9RLJsQrsq'
      });
      console.log('Started new ngrok tunnel:', url);
      return url;
    } catch (ngrokError) {
      console.error('Error starting ngrok tunnel:', ngrokError.message);
      
      // If ngrok fails, try to use existing tunnel again
      try {
        const response = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await response.json();
        if (data.tunnels && data.tunnels.length > 0) {
          const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
          if (httpsTunnel) {
            console.log('Using existing ngrok tunnel after error:', httpsTunnel.public_url);
            return httpsTunnel.public_url;
          }
        }
      } catch (fetchError) {
        console.log('Could not fetch existing tunnel info');
      }
      
      return null;
    }
  } catch (error) {
    console.error('Error starting ngrok:', error);
    return null;
  }
} 