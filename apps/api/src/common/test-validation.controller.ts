import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsUUID } from 'class-validator';
import { Public } from '../modules/auth/public.decorator';

class TestDto {
  @IsString()
  name: string;

  @IsUUID()
  id: string;
}

@Controller('test-validation')
export class TestValidationController {
  @Public()
  @Post()
  test(@Body() dto: TestDto) {
    return { success: true, data: dto };
  }
}
