import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class SignUpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  guestSessionId?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  referralVisitId?: string;

  @IsOptional()
  @IsString()
  referralVisitorId?: string;

  @IsOptional()
  initialStrategy?: any;
}
