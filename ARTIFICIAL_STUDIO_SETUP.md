# Setting Up Artificial Studio API for Virtual Try-On

This guide explains how to set up the Artificial Studio API for the virtual try-on functionality in your application.

## Step 1: Create an Artificial Studio Account

1. Go to [Artificial Studio's website](https://www.artificialstudio.ai/)
2. Sign up for an account
3. Navigate to your account settings or API section

## Step 2: Generate an API Key

1. In your Artificial Studio dashboard, find the API keys section
2. Generate a new API key
3. Save this key securely - you'll need it for the next step

## Step 3: Configure Your Application

1. Open the `.env` file in the root of your project
2. Replace the placeholder API key with your actual key:

```
TRYON_API_KEY=your_actual_api_key_from_artificial_studio
PUBLIC_URL=http://localhost:3000
```

If you're running in production, update the PUBLIC_URL to your actual domain:

```
PUBLIC_URL=https://your-domain.com
```

## Step 4: Configure Webhook Settings

The application uses webhooks to receive notifications when the try-on process is complete. Make sure:

1. Your server is accessible from the internet (or use a tool like ngrok during development)
2. The `PUBLIC_URL` in your `.env` file points to a valid URL that Artificial Studio can reach
3. The webhook endpoint at `/webhook` is exposed and not blocked by any firewalls

## Step 5: Testing the Integration

1. Start your application
2. Upload an image and select a garment
3. Click the "Try On" button
4. Check the console logs to ensure the API request is being sent correctly

If you encounter an error that says "Try-on service is not configured correctly. API key missing", make sure your API key is set in the `.env` file and that the application has been restarted after updating the file.

## Troubleshooting

- **API Key Issues**: Verify your API key is correct and properly formatted in the `.env` file
- **Webhook Problems**: Make sure your server is accessible from the internet and the PUBLIC_URL is correct
- **404 Errors**: Check that backend.js is properly loaded in your HTML file
- **Image Format Issues**: Make sure your uploaded images are in formats supported by Artificial Studio (typically JPG, PNG, WebP)

### Common Error: "window.submitTryOnRequest is not a function"
If you see this error in your browser console:
1. Check that backend.js is properly loaded at the correct path
2. Make sure there are no JavaScript errors in the console prior to this error
3. The path should be `/backend.js` (not `/static/backend.js`)
4. Try clearing your browser cache and reloading the page

### Firestore Permissions Error
If you see `FirebaseError: Missing or insufficient permissions` when updating trial counts:
1. This usually happens because your Firebase security rules are restricting write access
2. You can modify your Firestore security rules to allow updates to the try-on counts
3. Alternatively, our implementation now handles this error gracefully and continues with the try-on process

### API Key Missing Error
If you see `Try-on service is not configured correctly. API key missing`:
1. Make sure the TRYON_API_KEY is set in your .env file
2. The server needs to be restarted after changing environment variables
3. Verify that your API key is valid by testing it directly with the Artificial Studio API

## Artificial Studio API Reference

For more information on the API capabilities, refer to the official documentation:

```javascript
// Example API request
const response = await fetch('https://api.artificialstudio.ai/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'try-clothes',
    input: {
      human: "https://example.com/your-human-image.jpg",
      garment: "https://example.com/your-garment-image.jpg",
      garment_description: "descriptive text",
      category: "upper_body"
    },
    webhook: "https://your-server.com/webhook?job_id=your_job_id"
  })
});
```

Valid category values include:
- `upper_body`: For tops, shirts, jackets, etc.
- `lower_body`: For pants, shorts, skirts, etc.
- `dress`: For dresses
- `full_body`: For full-body outfits

## Support

If you need assistance, contact Artificial Studio support or check their documentation for more detailed instructions and API references. 