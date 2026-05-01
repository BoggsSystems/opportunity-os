import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { getConfig } from '@opportunity-os/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const config = getConfig();
    super({
      clientID: config.GOOGLE_CLIENT_ID || 'google-client-id-not-configured',
      clientSecret: config.GOOGLE_CLIENT_SECRET || 'google-client-secret-not-configured',
      callbackURL: config.GOOGLE_CALLBACK_URL || 'http://localhost:3002/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      provider: 'google',
      providerId: profile.id,
    };
    
    // We pass this to the controller which will call authService
    done(null, user);
  }
}
