import { NextRequest, NextResponse } from 'next/server';
import { Issuer, generators } from 'openid-client';

// Environment variables for better security
const cognitoDomain = process.env.COGNITO_DOMAIN || 'https://yourapp.auth.ap-south-1.amazoncognito.com';
const redirectUri = process.env.COGNITO_REDIRECT_URI || 'http://localhost:3000/api/callback';
const client_id = process.env.COGNITO_CLIENT_ID!;
const client_secret = process.env.COGNITO_CLIENT_SECRET!;
const issuerURL = process.env.COGNITO_ISSUER_URL || 'https://cognito-idp.ap-south-1.amazonaws.com/your-pool-id';
const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/?error=${error}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return NextResponse.redirect(`${baseUrl}/?error=NoCode`);
  }

  try {
    // Discover the issuer
    const issuer = await Issuer.discover(issuerURL);
    
    // Create the client
    const client = new issuer.Client({
      client_id,
      client_secret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
    });

    // Exchange code for tokens
    const tokenSet = await client.callback(redirectUri, { code, state });

    // Validate tokens
    if (!tokenSet.access_token || !tokenSet.id_token) {
      throw new Error('Invalid token response');
    }

    // Create response with redirect
    const response = NextResponse.redirect(`${baseUrl}/dashboard`); // Redirect to dashboard instead of home

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    // Set cookies
    response.cookies.set('id_token', tokenSet.id_token, cookieOptions);
    response.cookies.set('access_token', tokenSet.access_token, cookieOptions);
    
    if (tokenSet.refresh_token) {
      response.cookies.set('refresh_token', tokenSet.refresh_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30 days for refresh token
      });
    }

    // Set token expiration
    if (tokenSet.expires_at) {
      response.cookies.set('token_expires_at', tokenSet.expires_at.toString(), cookieOptions);
    }

    return response;
  } catch (err) {
    console.error('Error in Cognito callback:', err);
    
    // More specific error handling
    if (err instanceof Error) {
      if (err.message.includes('invalid_grant')) {
        return NextResponse.redirect(`${baseUrl}/?error=InvalidGrant`);
      }
      if (err.message.includes('invalid_client')) {
        return NextResponse.redirect(`${baseUrl}/?error=InvalidClient`);
      }
    }
    
    return NextResponse.redirect(`${baseUrl}/?error=AuthFailed`);
  }
}