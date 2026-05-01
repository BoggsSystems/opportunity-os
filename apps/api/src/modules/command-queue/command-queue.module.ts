import { Module } from "@nestjs/common";
import { CommandQueueController } from "./command-queue.controller";
import { CommandQueueService } from "./command-queue.service";

@Module({
  controllers: [CommandQueueController],
  providers: [CommandQueueService],
  exports: [CommandQueueService],
})
export class CommandQueueModule {}
