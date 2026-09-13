import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { ContextLogger } from './context-logger.type';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

@Injectable()
export class AppLogger {
  constructor(private readonly configService: AppConfigService) {}

  /**
   * Ghi thông tin phục vụ chẩn đoán kỹ thuật.
   *
   * @example
   * this.logger.debug(
   *   'appointment_search_query',
   *   { page, limit },
   *   AppointmentService.name,
   * );
   */
  debug(event: string, fields: LogFields = {}, context?: string): void {
    this.write('debug', event, fields, context);
  }

  /**
   * Ghi sự kiện xử lý thành công hoặc trạng thái vận hành bình thường.
   *
   * @example
   * this.logger.info(
   *   'appointment_created',
   *   { appointmentId },
   *   AppointmentService.name,
   * );
   */
  info(event: string, fields: LogFields = {}, context?: string): void {
    this.write('info', event, fields, context);
  }

  /**
   * Ghi tình huống dự kiến nhưng cần theo dõi, thường là HTTP 4xx.
   * Không truyền exception hoặc stack trace vào warn.
   *
   * @example
   * this.logger.warn(
   *   'http_request_rejected',
   *   { method: 'POST', path: '/appointments', statusCode: 422 },
   *   LoggingInterceptor.name,
   * );
   */
  warn(event: string, fields: LogFields = {}, context?: string): void {
    this.write('warn', event, fields, context);
  }

  /**
   * Ghi lỗi hệ thống cần điều tra, thường là HTTP 5xx hoặc lỗi không mong đợi.
   *
   * `exception` phải là exception/error gốc đã catch được;
   * không truyền error.message dạng string.
   * AppLogger sẽ tự trích name, message và stack để log,
   * còn response client không bao giờ nhận stack.
   *
   * @example
   * try {
   *   await this.repository.save(appointment);
   * } catch (error) {
   *   this.logger.error(
   *     'appointment_persist_failed',
   *     error,
   *     { appointmentId },
   *     AppointmentService.name,
   *   );
   *   throw error;
   * }
   */
  error(
    event: string,
    exception: unknown,
    fields: LogFields = {},
    context?: string,
  ): void {
    this.write(
      'error',
      event,
      {
        ...fields,
        error: this.toErrorDetails(exception),
      },
      context,
    );
  }

  /**
   * Tạo logger có context cố định cho một component.
   *
   * @param context Tên component phát log, ví dụ `AppointmentService.name`.
   *
   * @example
   * export class AppointmentService {
   *   private readonly logger: ContextLogger;
   *
   *   constructor(appLogger: AppLogger) {
   *     this.logger = appLogger.forContext(AppointmentService.name);
   *   }
   *
   *   create() {
   *     this.logger.info('appointment_created', { appointmentId: 'apt_001' });
   *   }
   * }
   */
  forContext(context: string): ContextLogger {
    return {
      debug: (event, fields) => this.debug(event, fields, context),
      info: (event, fields) => this.info(event, fields, context),
      warn: (event, fields) => this.warn(event, fields, context),
      error: (event, error, fields) =>
        this.error(event, error, fields, context),
    };
  }

  /**
   * Tạo structured log payload chuẩn, redact field nhạy cảm và gửi log tới
   * output phù hợp với môi trường.
   *
   * - Development/staging: Nest Logger để đọc nhanh trên console.
   * - Production: một JSON object trên một dòng qua stdout để Alloy/Promtail
   *   thu thập và gửi vào Loki.
   *
   * Hàm này là implementation detail; service/interceptor chỉ gọi
   * debug/info/warn/error, không gọi write hoặc process.stdout.write trực tiếp.
   */
  private write(
    level: LogLevel,
    event: string,
    fields: LogFields,
    context?: string,
  ): void {
    const payload = {
      ...this.sanitize(fields),
      timestamp: new Date().toISOString(),
      level,
      event,
      service: this.configService.applicationConfig.shortName,
      environment: this.configService.runtimeConfig.nodeEnv,
      ...(context ? { context } : {}),
    };

    const isProduction = this.configService.runtimeConfig.isProduction;
    const message = JSON.stringify(payload, null, isProduction ? undefined : 2);

    if (isProduction) {
      process.stdout.write(`${message}\n`);
      return;
    }

    const logger = new Logger(context ?? AppLogger.name);

    switch (level) {
      case 'debug':
        logger.debug(message);
        break;
      case 'info':
        logger.log(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message);
        break;
    }
  }

  private toErrorDetails(exception: unknown) {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      };
    }

    return {
      name: 'UnknownError',
      message: String(exception),
    };
  }

  private sanitize(fields: LogFields): LogFields {
    const sensitiveKeys = new Set([
      'authorization',
      'cookie',
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
    ]);

    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        sensitiveKeys.has(key) ? '[REDACTED]' : value,
      ]),
    );
  }
}
