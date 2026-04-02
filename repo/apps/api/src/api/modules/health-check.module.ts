import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthCheckController } from '../controllers/health-check.controller';
import { TemplateController } from '../controllers/template.controller';
import { HealthCheckService } from '../../core/application/use-cases/health-check.service';
import { SignatureService } from '../../core/application/use-cases/signature.service';
import { PdfExportService } from '../../infrastructure/pdf/pdf-export.service';
import { ComplianceCheckService } from '../../infrastructure/scheduling/compliance-check.service';
import { HealthCheckEntity } from '../../infrastructure/persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../../infrastructure/persistence/entities/health-check-version.entity';
import { ResultItemEntity } from '../../infrastructure/persistence/entities/result-item.entity';
import { ReportTemplateEntity } from '../../infrastructure/persistence/entities/report-template.entity';
import { ReportSignatureEntity } from '../../infrastructure/persistence/entities/report-signature.entity';
import { ReportPdfEntity } from '../../infrastructure/persistence/entities/report-pdf.entity';
import { UserEntity } from '../../infrastructure/persistence/entities/user.entity';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HealthCheckEntity,
      HealthCheckVersionEntity,
      ResultItemEntity,
      ReportTemplateEntity,
      ReportSignatureEntity,
      ReportPdfEntity,
      UserEntity,
    ]),
    AuthModule,
  ],
  controllers: [HealthCheckController, TemplateController],
  providers: [
    HealthCheckService,
    SignatureService,
    PdfExportService,
    ComplianceCheckService,
  ],
  exports: [HealthCheckService],
})
export class HealthCheckModule {}
