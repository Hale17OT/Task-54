import { Controller, Get } from '@nestjs/common';
import { HealthCheckService } from '../../core/application/use-cases/health-check.service';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '@checc/shared/constants/roles';

@Controller('templates')
export class TemplateController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.REVIEWER)
  async list() {
    const templates = await this.healthCheckService.getTemplates();
    return { data: templates };
  }
}
