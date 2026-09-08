import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { TypedConfigService } from '../../config/typed-config.service';
import { UnauthorizedError } from '../errors/unauthorized.error';
import { timingSafeCompare } from '../utils/timing-safe-compare';
import { API_KEY_HEADER } from './api-key.constant';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly config: TypedConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('ADMIN_API_KEY', { infer: true });

    // No key configured is a deliberate choice: the guarded route stays open.
    if (expected === null) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[API_KEY_HEADER];

    if (
      typeof provided !== 'string' ||
      !timingSafeCompare(provided, expected)
    ) {
      throw new UnauthorizedError();
    }

    return true;
  }
}
