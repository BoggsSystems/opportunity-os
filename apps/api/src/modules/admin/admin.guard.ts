import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { getConfig } from "@opportunity-os/config";

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly config = getConfig();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email = request.user?.email?.toLowerCase();
    const configuredEmails = this.adminEmails();

    if (!email) {
      throw new ForbiddenException("Admin access requires an authenticated user");
    }

    if (!configuredEmails.length && this.config.NODE_ENV !== "production") {
      return true;
    }

    if (configuredEmails.includes(email)) {
      return true;
    }

    throw new ForbiddenException("Admin access is not enabled for this user");
  }

  private adminEmails(): string[] {
    const raw = process.env["ADMIN_EMAILS"] || "";
    return raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }
}
