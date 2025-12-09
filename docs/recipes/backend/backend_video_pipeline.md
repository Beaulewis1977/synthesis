---
title: "Serverless AI Video Pipeline"
platform: backend
framework: cloudflare
feature_tags:
  - video
  - ai
  - serverless
usage_tier: recipe
framework_version: "2024"
tech_stack:
  - cloudflare_workers
  - cloudflare_r2
  - replicate
difficulty: advanced
last_updated: 2025-12-08
recommended: true
---

# Serverless AI Video Pipeline

> **Summary:** Architecture for generating AI videos using Replicate, storing large files in Cloudflare R2, and orchestrating the workflow with Cloudflare Workers.

## Prerequisites

- [ ] Cloudflare Account (Workers + R2 enabled)
- [ ] Replicate API Key

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Cloudflare Workers | Latest | Orchestrator |
| Cloudflare R2 | Latest | Zero-egress Object Storage |
| Replicate API | HTTP | AI Generation (Sora, Stable Video) |

## Implementation

### 1. Trigger Worker (Start Job)

This worker receives a request from the mobile app, validates the user, and triggers Replicate.

```typescript
// src/worker.ts (Cloudflare Worker)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prompt, userId } = await request.json();

    // 1. Call Replicate
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "model-version-id",
        input: { prompt },
        // IMPORTANT: Webhook callback
        webhook: "https://api.myapp.com/webhooks/video-completed",
        webhook_events_filter: ["completed"]
      }),
    });

    const prediction = await response.json();
    
    // 2. Save Pending Job to DB (e.g. Supabase via REST)
    // await saveJobToSupabase(prediction.id, userId, 'pending')

    return new Response(JSON.stringify({ jobId: prediction.id }));
  }
}
```

### 2. Webhook Handler (Completion)

This worker handles the callback from Replicate. It downloads the video and uploads it to R2.

**Why R2?** Replicate URLs expire. You need to own the asset. R2 has zero egress fees.

> **⚠️ SECURITY WARNING:** The signature verification below is not fully implemented. You **MUST** implement proper HMAC verification using `env.WEBHOOK_SECRET` before deploying to production. See [Replicate's webhook security documentation](https://replicate.com/docs/webhooks) for implementation details.

```typescript
// src/webhook.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 1. Verify Webhook Signature (Security) - REQUIRED FOR PRODUCTION
      const webhookId = request.headers.get('webhook-id');
      const webhookTimestamp = request.headers.get('webhook-timestamp');
      const webhookSignature = request.headers.get('webhook-signature');

      if (!webhookId || !webhookTimestamp || !webhookSignature) {
        throw new Error('Missing webhook headers');
      }

      // Replicate signatures are space-separated (e.g., "v1,signature1 v1,signature2")
      const signatures = webhookSignature.split(' ').map(sig => sig.split(',')[1]);
      
      // Construct the signed content
      const bodyText = await request.text(); // Need raw text for verification
      const signedContent = `${webhookId}.${webhookTimestamp}.${bodyText}`;
      
      // TODO: IMPLEMENT THIS - Required for production!
      // const isValid = await verifyHMAC(env.WEBHOOK_SECRET, signedContent, signatures);
      // if (!isValid) throw new Error('Invalid signature');

      const prediction = JSON.parse(bodyText);
    
      if (prediction.status === 'succeeded') {
        const videoUrl = prediction.output;
        
        // Validate URL and prevent SSRF
        try {
          const parsedUrl = new URL(videoUrl);
          // Allowlist Replicate domains to prevent SSRF attacks
          const allowedHosts = ['replicate.delivery', 'pbxt.replicate.delivery'];
          if (!allowedHosts.some(host => parsedUrl.host.endsWith(host))) {
            throw new Error(`URL host not in allowlist: ${parsedUrl.host}`);
          }
          if (parsedUrl.protocol !== 'https:') {
            throw new Error('Only HTTPS URLs allowed');
          }
        } catch (e) {
          throw new Error(`Invalid or disallowed URL: ${e}`);
        }
        
        // 2. Download Video (Safely)
        const videoResp = await fetch(videoUrl, { signal: AbortSignal.timeout(300_000) });
        if (!videoResp.ok) throw new Error(`Download failed: ${videoResp.status}`);
        
        // Strict Size Check
        const contentLength = videoResp.headers.get('content-length');
        if (!contentLength) throw new Error('Missing content-length');
        if (parseInt(contentLength) > 500 * 1024 * 1024) throw new Error('Video too large');

        // 3. Upload to R2
        const filename = `${prediction.id}.mp4`;
        const contentType = videoResp.headers.get('content-type') || 'video/mp4';
        
        await env.VIDEO_BUCKET.put(filename, videoResp.body, {
          httpMetadata: { contentType: contentType }
        });

        // 4. Update DB
      } else if (prediction.status === 'failed') {
        console.warn(`Job failed: ${prediction.error}`);
      }

      return new Response(JSON.stringify({ status: 'processed' }));
      
    } catch (error) {
      console.error('Webhook Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}
```

### 3. R2 Bucket Configuration

Ensure your R2 bucket is connected to a custom domain (e.g., `cdn.myapp.com`) for public access.

## Common Pitfalls

### 1. Worker Execution Time limit

**Problem:** Downloading/Uploading large videos might exceed the 10s (Free) or 30s CPU time (Paid) limits.

**Solution:** I/O time (waiting for fetch) doesn't count towards CPU time. However, for 4K video, consider using **Stream pipelines** (`response.body.pipeTo`) instead of loading the whole blob into memory.

### 2. Webhook Security

**Problem:** Anyone can call your webhook endpoint.

**Solution:** Verify Replicate signatures (if available) or include a secret in the webhook URL query param: `...?secret=${env.WEBHOOK_SECRET}`.
