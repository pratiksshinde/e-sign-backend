import { Module } from '@nestjs/common';
import { DocusealService } from './docuseal.service';

@Module({
  providers: [DocusealService],
  exports: [DocusealService],
})
export class DocusealModule {}
