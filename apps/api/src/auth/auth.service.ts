import { argon2id, hash, verify } from 'argon2';
import { Injectable, HttpStatus, Inject } from '@nestjs/common';

import { ApiException } from './api-exception';
import { STAFF_SESSION_TTL_MS, STAFF_USER_REPOSITORY } from './auth.constants';
import type { PublicStaffUser, StaffRequest, StaffSession, StaffUserRecord } from './auth.types';
import type { StaffLoginDto } from './dto/staff-login.dto';
import type { StaffUserRepository } from './staff-user.repository';

export interface StaffSessionResponse {
  user: PublicStaffUser;
  expiresAt: string;
}

function saveSession(session: StaffSession): Promise<void> {
  return new Promise((resolve, reject) => {
    session.save((error) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

function regenerateSession(request: StaffRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

function destroySession(session: StaffSession): Promise<void> {
  return new Promise((resolve, reject) => {
    session.destroy((error) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

@Injectable()
export class AuthService {
  private readonly invalidPasswordHash = this.createInvalidPasswordHash();

  public constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffUserRepository: StaffUserRepository,
  ) {}

  public async login(
    credentials: StaffLoginDto,
    request: StaffRequest,
  ): Promise<StaffSessionResponse> {
    const user = await this.staffUserRepository.findByEmail(credentials.email);
    const passwordHash = user?.passwordHash ?? (await this.invalidPasswordHash);
    const passwordMatches = await this.verifyPassword(passwordHash, credentials.password);

    if (user === null || !passwordMatches) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'INVALID_CREDENTIALS',
        message: 'Staff email or password is invalid.',
      });
    }

    await regenerateSession(request);
    request.session.staffUserId = user.id;
    await saveSession(request.session);

    return {
      user: this.toPublicUser(user),
      expiresAt: new Date(Date.now() + STAFF_SESSION_TTL_MS).toISOString(),
    };
  }

  public async getCurrentStaffUser(session: StaffSession | undefined): Promise<PublicStaffUser> {
    const user = await this.findAuthenticatedUser(session);
    return this.toPublicUser(user);
  }

  public async logout(session: StaffSession | undefined): Promise<void> {
    if (session?.staffUserId === undefined) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Staff session is missing or invalid.',
      });
    }

    await destroySession(session);
  }

  public async findAuthenticatedUser(session: StaffSession | undefined): Promise<StaffUserRecord> {
    const userId = session?.staffUserId;

    if (userId === undefined) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Staff session is missing or invalid.',
      });
    }

    const user = await this.staffUserRepository.findById(userId);

    if (user === null) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Staff session is missing or invalid.',
      });
    }

    return user;
  }

  private async verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  private createInvalidPasswordHash(): Promise<string> {
    return hash('room-service-invalid-password', { type: argon2id });
  }

  private toPublicUser(user: StaffUserRecord): PublicStaffUser {
    return {
      id: user.id,
      displayName: user.displayName,
      roles: [...user.roles],
      permissions: [...user.permissions],
    };
  }
}
