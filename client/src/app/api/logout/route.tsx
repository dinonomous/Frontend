import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.redirect('http://localhost:3000/');

  ['id_token', 'access_token', 'refresh_token'].forEach((cookie) => {
    response.cookies.set(cookie, '', {
      path: '/',
      httpOnly: true,
      maxAge: 0,
    });
  });

  // Optional: redirect to Cognito logout too
  const cognitoLogoutUrl = `https://<your-user-pool-domain>/logout?client_id=<your-client-id>&logout_uri=http://localhost:3000/`;

  return NextResponse.redirect(cognitoLogoutUrl);
}
