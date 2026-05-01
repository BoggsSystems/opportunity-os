import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { CommandQueueService } from "./command-queue.service";
import {
  GetTodayCommandQueueQueryDto,
  UpdateCommandQueueItemDto,
} from "./dto/command-queue.dto";

@Controller("command-queue")
export class CommandQueueController {
  constructor(private readonly commandQueueService: CommandQueueService) {}

  @Get("today")
  async getToday(
    @Query() query: GetTodayCommandQueueQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException("No authenticated user found");
    }

    return this.commandQueueService.getToday(user.id, {
      date: query.date,
      refresh: query.refresh === "true",
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post("today/refresh")
  async refreshToday(
    @Body() body: GetTodayCommandQueueQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException("No authenticated user found");
    }

    return this.commandQueueService.getToday(user.id, {
      date: body.date,
      refresh: true,
      limit: body.limit ? Number(body.limit) : undefined,
    });
  }

  @Patch("items/:id")
  async updateItem(
    @Param("id") id: string,
    @Body() body: UpdateCommandQueueItemDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException("No authenticated user found");
    }

    return this.commandQueueService.updateItem(user.id, id, body);
  }

  @Post("items/:id/present")
  async presentItem(
    @Param("id") id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException("No authenticated user found");
    }

    return this.commandQueueService.updateItem(user.id, id, {
      status: "presented",
    });
  }
}
