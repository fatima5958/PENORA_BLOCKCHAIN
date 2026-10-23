// api/feedback.ts
// PENORA Beta Private Feedback Submission Endpoint
// Secure, validated, rate-limited endpoint for tester feedback.

import { createClient } from '@supabase/supabase-js';

// In-memory rate limiting map: ip/identifier -> timestamp[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(identifier) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(identifier, timestamps);
  return false;
}

export async function POST(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    if (isRateLimited(ip)) {
      return Response.json(
        { error: 'Too many submissions. Please wait a moment before sending more feedback.' },
        { status: 429, headers }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400, headers });
    }

    const { category, message, pageUrl, userEmail } = body as {
      category?: string;
      message?: string;
      pageUrl?: string;
      userEmail?: string;
    };

    const validCategories = ['bug', 'suggestion', 'ux', 'other'];
    const chosenCategory = validCategories.includes(category ?? '') ? category : 'other';

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return Response.json(
        { error: 'Feedback message must be at least 5 characters long.' },
        { status: 400, headers }
      );
    }

    if (message.length > 2000) {
      return Response.json(
        { error: 'Feedback message cannot exceed 2000 characters.' },
        { status: 400, headers }
      );
    }

    const sanitizedMessage = message.trim();
    const sanitizedEmail = typeof userEmail === 'string' ? userEmail.slice(0, 100).trim() : null;
    const sanitizedUrl = typeof pageUrl === 'string' ? pageUrl.slice(0, 200).trim() : null;

    // Persist to Supabase if service credentials exist
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Insert into feedback table if available, fallback gracefully
        const { error } = await db.from('beta_feedback').insert({
          category: chosenCategory,
          message: sanitizedMessage,
          page_url: sanitizedUrl,
          user_email: sanitizedEmail,
          created_at: new Date().toISOString(),
        });

        if (error) {
          // Table may not yet be migrated in remote DB; log securely without failing tester
          console.info('[Beta Feedback Received]:', {
            category: chosenCategory,
            preview: sanitizedMessage.slice(0, 50),
            pageUrl: sanitizedUrl,
          });
        }
      } catch (dbErr) {
        console.info('[Beta Feedback DB fallback]:', dbErr);
      }
    } else {
      console.info('[Beta Feedback Logged]:', {
        category: chosenCategory,
        preview: sanitizedMessage.slice(0, 50),
      });
    }

    return Response.json(
      {
        success: true,
        message: 'Thank you for your beta feedback! Our engineering team will review it.',
      },
      { status: 200, headers }
    );
  } catch (err) {
    console.error('Feedback submission error:', err);
    return Response.json(
      { error: 'Unable to submit feedback at this time. Please try again.' },
      { status: 500, headers }
    );
  }
}
