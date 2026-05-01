import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { getConfig } from '@opportunity-os/config';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor() {
    const config = getConfig();
    super({
      clientID: config.LINKEDIN_CLIENT_ID,
      clientSecret: config.LINKEDIN_CLIENT_SECRET,
      callbackURL: config.LINKEDIN_CALLBACK_URL || 'http://localhost:3002/auth/linkedin/callback',
      scope: ['r_emailaddress', 'r_liteprofile'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
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
