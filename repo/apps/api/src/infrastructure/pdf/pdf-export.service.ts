import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { HealthCheckEntity } from '../persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../persistence/entities/health-check-version.entity';
import { ReportSignatureEntity } from '../persistence/entities/report-signature.entity';
import { ReportPdfEntity } from '../persistence/entities/report-pdf.entity';
import { UserEntity } from '../persistence/entities/user.entity';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../logging/winston.logger';

@Injectable()
export class PdfExportService {
  private readonly logger = new WinstonLogger();
  private readonly storagePath: string;

  constructor(
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepo: Repository<HealthCheckEntity>,
    @InjectRepository(HealthCheckVersionEntity)
    private readonly versionRepo: Repository<HealthCheckVersionEntity>,
    @InjectRepository(ReportSignatureEntity)
    private readonly signatureRepo: Repository<ReportSignatureEntity>,
    @InjectRepository(ReportPdfEntity)
    private readonly pdfRepo: Repository<ReportPdfEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    this.storagePath = process.env.PDF_STORAGE_PATH || 'data/pdfs';
  }

  async generateReport(healthCheckId: string, versionNumber: number): Promise<ReportPdfEntity> {
    const healthCheck = await this.healthCheckRepo.findOne({
      where: { id: healthCheckId },
    });

    if (!healthCheck) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    const version = await this.versionRepo.findOne({
      where: { healthCheckId, versionNumber },
      relations: ['resultItems'],
    });

    if (!version) {
      throw new NotFoundException({
        message: 'Health check version not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    // Fetch patient info
    const patient = await this.userRepo.findOne({
      where: { id: healthCheck.patientId },
    });

    // Fetch signature
    const signature = await this.signatureRepo.findOne({
      where: { healthCheckId, versionNumber },
    });

    let signerName = 'N/A';
    if (signature) {
      const signer = await this.userRepo.findOne({
        where: { id: signature.signerId },
      });
      if (signer) {
        signerName = signer.fullName;
      }
    }

    // Generate PDF using PDFKit
    const PDFDocument = await this.loadPDFKit();
    const doc = new PDFDocument({ margin: 50 });

    // Ensure storage directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    // Sanitize IDs to prevent directory traversal
    const safeId = healthCheckId.replace(/[^a-zA-Z0-9-]/g, '');
    const fileName = `report_${safeId}_v${versionNumber}.pdf`;
    const filePath = path.join(this.storagePath, fileName);
    // Verify resolved path is within storage directory
    const resolvedPath = path.resolve(filePath);
    const resolvedStorage = path.resolve(this.storagePath);
    if (!resolvedPath.startsWith(resolvedStorage)) {
      throw new BadRequestException({
        message: 'Invalid file path',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Title
    doc.fontSize(20).text('Health Check Report', { align: 'center' });
    doc.moveDown();

    // Patient info
    doc.fontSize(12).text(`Patient: ${patient?.fullName || 'Unknown'}`);
    doc.text(`Report ID: ${healthCheckId}`);
    doc.text(`Version: ${versionNumber}`);
    doc.text(`Date: ${version.createdAt.toISOString().slice(0, 10)}`);
    doc.text(`Status: ${version.status}`);
    doc.moveDown();

    // Results table header
    doc.fontSize(14).text('Test Results', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colWidths = { name: 120, value: 60, unit: 50, range: 100, flag: 40 };
    let yPos = tableTop;

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Test Name', 50, yPos, { width: colWidths.name });
    doc.text('Value', 170, yPos, { width: colWidths.value });
    doc.text('Unit', 230, yPos, { width: colWidths.unit });
    doc.text('Reference Range', 280, yPos, { width: colWidths.range });
    doc.text('Flag', 380, yPos, { width: colWidths.flag });
    yPos += 20;

    // Result rows
    doc.font('Helvetica');
    const sortedItems = (version.resultItems || []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    for (const item of sortedItems) {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      const refRange =
        item.referenceLow !== null && item.referenceHigh !== null
          ? `${item.referenceLow} - ${item.referenceHigh}`
          : 'N/A';

      doc.text(item.testName, 50, yPos, { width: colWidths.name });
      doc.text(item.value, 170, yPos, { width: colWidths.value });
      doc.text(item.unit, 230, yPos, { width: colWidths.unit });
      doc.text(refRange, 280, yPos, { width: colWidths.range });
      doc.text(item.flag || '', 380, yPos, { width: colWidths.flag });
      yPos += 18;
    }

    // Signature block
    doc.moveDown(2);
    if (signature) {
      doc.fontSize(12).text('Signature', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Signed by: ${signerName}`);
      doc.text(`Signed at: ${signature.signedAt.toISOString()}`);
      doc.text(`Signature Hash: ${signature.signatureHash.slice(0, 32)}...`);
    }

    doc.end();

    // Wait for the write stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Compute SHA-256 checksum
    const fileBuffer = fs.readFileSync(filePath);
    const sha256Checksum = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');
    const fileSizeBytes = fileBuffer.length;

    // Store in report_pdfs table
    const pdfRecord = this.pdfRepo.create({
      healthCheckId,
      versionNumber,
      filePath,
      fileSizeBytes,
      sha256Checksum,
      generatedAt: new Date(),
    });
    const saved = await this.pdfRepo.save(pdfRecord);

    this.logger.log(
      `PDF generated for health check ${healthCheckId} v${versionNumber}: ${filePath}`,
      'PdfExportService',
    );

    return saved;
  }

  async downloadReport(
    healthCheckId: string,
    versionNumber: number,
  ): Promise<{ filePath: string; fileName: string }> {
    const pdfRecord = await this.pdfRepo.findOne({
      where: { healthCheckId, versionNumber },
    });

    if (!pdfRecord) {
      throw new NotFoundException({
        message: 'PDF report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    // Validate checksum
    if (fs.existsSync(pdfRecord.filePath)) {
      const fileBuffer = fs.readFileSync(pdfRecord.filePath);
      const checksum = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');

      if (checksum !== pdfRecord.sha256Checksum) {
        throw new BadRequestException({
          message: 'PDF file integrity check failed',
          errorCode: ErrorCodes.PDF_CHECKSUM_MISMATCH,
        });
      }
    } else {
      throw new NotFoundException({
        message: 'PDF file not found on disk',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    const fileName = `report_${healthCheckId}_v${versionNumber}.pdf`;
    return { filePath: pdfRecord.filePath, fileName };
  }

  private async loadPDFKit() {
    // Dynamic import to avoid hard dependency issues
    try {
      const PDFKit = await import('pdfkit');
      return PDFKit.default || PDFKit;
    } catch {
      // Fallback: create a minimal text-based PDF structure
      this.logger.warn(
        'PDFKit not available, using minimal PDF generator',
        'PdfExportService',
      );
      return this.createMinimalPdfDocument();
    }
  }

  private createMinimalPdfDocument() {
    // Returns a minimal writable document-like object
    // that produces a valid (basic) PDF when PDFKit is not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PassThrough } = require('stream');

    return class MinimalDoc extends PassThrough {
      constructor(_opts?: Record<string, unknown>) {
        super();
      }
      fontSize() { return this; }
      font() { return this; }
      text() { return this; }
      moveDown() { return this; }
      addPage() { return this; }
      pipe(dest: NodeJS.WritableStream) {
        super.pipe(dest);
        return dest;
      }
      end() {
        this.push(Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF'));
        this.push(null);
      }
      get y() { return 0; }
    };
  }
}
