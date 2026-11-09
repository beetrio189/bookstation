import { Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | undefined;
  picture: string | undefined;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly client = new OAuth2Client({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: env.googleRedirectUri,
  });

  buildAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  async getProfile(code: string): Promise<GoogleProfile> {
    try {
      const { tokens } = await this.client.getToken(code);
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token ?? '',
        audience: env.googleClientId,
      });
      const payload = ticket.getPayload();

      if (payload?.email && payload.email_verified) {
        return {
          sub: payload.sub,
          email: payload.email.toLowerCase(),
          name: payload.name,
          picture: payload.picture,
        };
      }
    } catch (error) {
      this.logger.warn(error);
    }

    throw new AppException(ERRORS.GOOGLE_AUTH_FAILED);
  }
}
