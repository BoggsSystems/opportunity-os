import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { getConfig } from '@opportunity-os/config';
import { AuthService } from './auth.service';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(private readonly authService: AuthService) {
    const config = getConfig();
    super({
      clientID: config.LINKEDIN_CLIENT_ID,
      clientSecret: config.LINKEDIN_CLIENT_SECRET,
      callbackURL: config.LINKEDIN_CALLBACK_URL || 'http://localhost:3001/auth/linkedin/callback',
      scope: ['r_emailaddress', 'r_liteprofile'],
      state: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { id, emails, name, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos?.[0]?.value,
      accessToken,
      provider: 'linkedin',
      providerId: id,
    };
    
    done(null, user);
  }
}
