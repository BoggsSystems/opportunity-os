import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignUpDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Guards handles redirect
  }

  @Public()
  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.validateGoogleUser(req.user);
    
    // Redirect to frontend with tokens in query (simple for now) or cookie
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5174';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}&provider=google`;
    
    return res.redirect(redirectUrl);
  }

  @Public()
  @Get('linkedin')
  @UseGuards(PassportAuthGuard('linkedin'))
  async linkedinAuth(@Req() req: any) {
    // Guards handles redirect
  }

  @Public()
  @Get('linkedin/callback')
  @UseGuards(PassportAuthGuard('linkedin'))
  async linkedinAuthRedirect(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.validateLinkedInUser(req.user);
    
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5174';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}&provider=linkedin`;
    
    return res.redirect(redirectUrl);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshSessionDto) {
    return this.authService.refreshSession(dto);
  }

  @Post('logout')
  async logout(@CurrentUser() user?: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Post('logout-all')
  async logoutAll(@CurrentUser() user?: AuthenticatedUser) {
    return this.authService.logoutAll(user?.id ?? '');
  }

  @Get('me')
  async me(@CurrentUser() user?: AuthenticatedUser) {
    return this.authService.getCurrentUser(user?.id ?? '');
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }
}
