import { Controller, Get } from '@nestjs/common';
import { HealthCheckService } from '../../core/application/use-cases/health-check.service';

@Controller('templates')
export class TemplateController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get()
  async list() {
    const templates = await this.healthCheckService.getTemplates();
    return { data: templates };
  }
}
