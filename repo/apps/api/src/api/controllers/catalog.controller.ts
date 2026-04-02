import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogServiceEntity } from '../../infrastructure/persistence/entities/catalog-service.entity';
import { SeatReservationEntity } from '../../infrastructure/persistence/entities/seat-reservation.entity';
import { ErrorCodes } from '@checc/shared/constants/error-codes';

@Controller('catalog')
export class CatalogController {
  constructor(
    @InjectRepository(CatalogServiceEntity)
    private readonly catalogRepo: Repository<CatalogServiceEntity>,
    @InjectRepository(SeatReservationEntity)
    private readonly seatRepo: Repository<SeatReservationEntity>,
  ) {}

  @Get()
  async list() {
    const services = await this.catalogRepo.find({
      where: { isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });

    const data = await Promise.all(
      services.map(async (s) => {
        let availableSeats: number | null = null;
        if (s.maxSeats !== null) {
          const reserved = await this.seatRepo.count({
            where: [
              { serviceId: s.id, status: 'HELD' },
              { serviceId: s.id, status: 'CONFIRMED' },
            ],
          });
          availableSeats = s.maxSeats - reserved;
        }
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          description: s.description,
          basePrice: Number(s.basePrice),
          category: s.category,
          isActive: s.isActive,
          maxSeats: s.maxSeats,
          availableSeats,
        };
      }),
    );

    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const service = await this.catalogRepo.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException({
        message: 'Catalog service not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    let availableSeats: number | null = null;
    if (service.maxSeats !== null) {
      const reserved = await this.seatRepo.count({
        where: [
          { serviceId: service.id, status: 'HELD' },
          { serviceId: service.id, status: 'CONFIRMED' },
        ],
      });
      availableSeats = service.maxSeats - reserved;
    }

    return {
      data: {
        id: service.id,
        code: service.code,
        name: service.name,
        description: service.description,
        basePrice: Number(service.basePrice),
        category: service.category,
        isActive: service.isActive,
        maxSeats: service.maxSeats,
        availableSeats,
      },
    };
  }
}
