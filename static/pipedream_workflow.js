// Pipedream workflow example for forwarding Artificial Studio webhooks
// Copy this code into a "Run Node.js Code" step in your Pipedream workflow

export default defineComponent({
  async run({steps, $}) {
    // Get job_id from the query string
    const jobId = steps.trigger.event.query.job_id;
    
    if (!jobId) {
      console.log('No job_id found in webhook URL');
      return {
        error: 'Missing job_id in webhook URL'
      };
    }
    
    console.log('Received webhook for job:', jobId);
    
    try {
      // Forward the webhook to your local server
      // Note: In real use, you'd want to use ngrok or a similar service to expose your local server
      // For testing, this will capture the webhook data for manual input
      
      // This is the data received from Artificial Studio
      const webhookData = steps.trigger.event.body;
      console.log('Webhook data:', webhookData);
      
      // You would normally do this, but for local development we'll just log it:
      // const response = await fetch(`http://your-public-url/webhook?job_id=${jobId}`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(webhookData)
      // });
      
      // For development, you can manually copy the output URL from the Pipedream logs
      // and paste it into the "Already have a result URL?" field in the app
      
      return {
        jobId,
        success: true,
        webhookData,
        message: 'Webhook received. You can manually copy the output URL from webhookData above.'
      };
    } catch (error) {
      console.error('Error forwarding webhook:', error);
      return {
        jobId,
        error: error.message
      };
    }
  }
}); 