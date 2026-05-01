import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { GoogleStrategy } from "./google.strategy";
import { LinkedInStrategy } from "./linkedin.strategy";
import { CommercialModule } from "../commercial/commercial.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [CommercialModule, AdminModule, PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    GoogleStrategy,
    LinkedInStrategy,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
