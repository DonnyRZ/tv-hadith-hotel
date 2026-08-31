import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/decorators/current-staff.decorator';
import type { PublicStaffUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { ListMenuItemsDto } from './dto/list-menu-items.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuService } from './menu.service';

@Controller('management')
@UseGuards(StaffSessionGuard, PermissionsGuard)
@RequirePermissions('menu:manage')
export class MenuController {
  public constructor(private readonly menuService: MenuService) {}

  @Get('menu-items')
  public listItems(@CurrentStaff() staff: PublicStaffUser, @Query() query: ListMenuItemsDto) {
    return this.menuService.listItems(staff, query);
  }

  @Post('menu-items')
  @HttpCode(HttpStatus.CREATED)
  public createItem(@CurrentStaff() staff: PublicStaffUser, @Body() input: CreateMenuItemDto) {
    return this.menuService.createItem(staff, input);
  }

  @Get('menu-items/:menuItemId')
  public getItem(@CurrentStaff() staff: PublicStaffUser, @Param('menuItemId') menuItemId: string) {
    return this.menuService.getItem(staff, menuItemId);
  }

  @Patch('menu-items/:menuItemId')
  public updateItem(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('menuItemId') menuItemId: string,
    @Body() input: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(staff, menuItemId, input);
  }

  @Post('menu-items/:menuItemId/activate')
  @HttpCode(HttpStatus.OK)
  public activateItem(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.menuService.setItemActive(staff, menuItemId, true);
  }

  @Post('menu-items/:menuItemId/deactivate')
  @HttpCode(HttpStatus.OK)
  public deactivateItem(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.menuService.setItemActive(staff, menuItemId, false);
  }
}
