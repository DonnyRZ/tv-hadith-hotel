import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/decorators/current-staff.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { PublicStaffUser } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { ManagementService } from './management.service';

@Controller('management')
@UseGuards(StaffSessionGuard, PermissionsGuard)
export class ManagementController {
  public constructor(private readonly managementService: ManagementService) {}

  @Get('users')
  @RequirePermissions('user:manage')
  public listUsers() {
    return this.managementService.listUsers();
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('user:manage')
  public createUser(@Body() input: CreateStaffUserDto) {
    return this.managementService.createUser(input);
  }

  @Patch('users/:userId')
  @RequirePermissions('user:manage')
  public updateUser(
    @Param('userId') userId: string,
    @Body() input: UpdateStaffUserDto,
    @CurrentStaff() staff: PublicStaffUser,
  ) {
    return this.managementService.updateUser(userId, input, staff.id);
  }

  @Post('users/:userId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user:manage')
  public deactivateUser(@Param('userId') userId: string, @CurrentStaff() staff: PublicStaffUser) {
    return this.managementService.setUserActive(userId, false, staff.id);
  }

  @Post('users/:userId/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user:manage')
  public reactivateUser(@Param('userId') userId: string, @CurrentStaff() staff: PublicStaffUser) {
    return this.managementService.setUserActive(userId, true, staff.id);
  }

  @Post('users/:userId/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user:manage')
  public resetPassword(@Param('userId') userId: string, @Body() input: ResetStaffPasswordDto) {
    return this.managementService.resetPassword(userId, input);
  }

  @Get('roles')
  @RequirePermissions('role:manage')
  public listRoles() {
    return this.managementService.listRoles();
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('role:manage')
  public createRole(@Body() input: CreateRoleDto) {
    return this.managementService.createRole(input);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('role:manage')
  public updateRole(@Param('roleId') roleId: string, @Body() input: UpdateRoleDto) {
    return this.managementService.updateRole(roleId, input);
  }

  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('role:manage')
  public deleteRole(@Param('roleId') roleId: string) {
    return this.managementService.deleteRole(roleId);
  }
}
