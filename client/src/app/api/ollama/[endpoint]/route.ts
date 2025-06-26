import { type NextRequest } from 'next/server';

// POST handler
export async function POST(request: NextRequest, context: { params: any }) {
  const { endpoint } = await context.params;

  const body = await request.text();
  const upstream = await fetch(`http://localhost:11434/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
    },
  });
}

// GET handler
export async function GET(_request: NextRequest, context: { params: any }) {
  const { endpoint } = await context.params;

  const upstream = await fetch(`http://localhost:11434/api/${endpoint}`);

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
    },
  });
}
