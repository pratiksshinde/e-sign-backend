import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { DocumentsModule } from './documents/documents.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('DB_URL') || '';
        const useSsl =
          config.get<string>('DB_SSL') === 'true' ||
          dbUrl.includes('sslmode=require');

        return {
          dialect: 'postgres',
          uri: dbUrl,
          autoLoadModels: true,
          synchronize: true,
          sync: { alter: true },
          ...(useSsl && {
            dialectOptions: {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            },
          }),
        };
      },
    }),

    DocumentsModule,
    WorkflowsModule,
    WebhooksModule,
  ],
})
export class AppModule {}