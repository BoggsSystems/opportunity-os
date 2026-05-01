import { Injectable } from '@nestjs/common';

@Injectable()
export class SimAuthService {
  /**
   * Generates a high-fidelity simulated profile for Google/LinkedIn/Microsoft OAuth flows.
   */
  generateProfile(email: string, fullName: string, provider: 'google' | 'linkedin' | 'microsoft' = 'google') {
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');
    
    return {
      email,
      firstName,
      lastName,
      providerId: `sim_${provider}_${Buffer.from(email).toString('base64').substr(0, 8)}`,
      accessToken: `sim_access_token_${Date.now()}`,
      refreshToken: `sim_refresh_token_${Date.now()}`,
    };
  }
}
