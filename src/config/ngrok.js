import ngrok from 'ngrok';

// Start ngrok
export async function startNgrok() {
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

    // If no existing tunnel, start a new one
    const url = await ngrok.connect({
      addr: 3000,
      proto: 'http'
    });
    console.log('Started new ngrok tunnel:', url);
    return url;
  } catch (error) {
    console.error('Error starting ngrok:', error);
    return null;
  }
} 