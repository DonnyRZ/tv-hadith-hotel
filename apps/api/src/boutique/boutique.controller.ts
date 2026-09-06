import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/decorators/current-staff.decorator';
import type { PublicStaffUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { CreateBoutiqueCategoryDto, UpdateBoutiqueCategoryDto } from './dto/create-category.dto';
import { CreateBoutiqueProductDto, UpdateBoutiqueProductDto } from './dto/create-product.dto';
import { ListBoutiqueDto } from './dto/list-boutique.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { CreateBoutiqueVariantDto, UpdateBoutiqueVariantDto } from './dto/variant.dto';
import { BoutiqueService } from './boutique.service';

@Controller('management/boutique')
@UseGuards(StaffSessionGuard, PermissionsGuard, RolesGuard)
@RequireRoles('BUTIK_INDONESIA')
export class BoutiqueController {
  public constructor(private readonly boutiqueService: BoutiqueService) {}

  @Get('categories')
  @RequirePermissions('menu:manage')
  public listCategories(@Query() query: ListBoutiqueDto) {
    return this.boutiqueService.listCategories(query.includeInactive ?? true);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('menu:manage')
  public createCategory(@Body() input: CreateBoutiqueCategoryDto) {
    return this.boutiqueService.createCategory(input);
  }

  @Patch('categories/:categoryId')
  @RequirePermissions('menu:manage')
  public updateCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() input: UpdateBoutiqueCategoryDto,
  ) {
    return this.boutiqueService.updateCategory(categoryId, input);
  }

  @Post('categories/:categoryId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  public activateCategory(@Param('categoryId', new ParseUUIDPipe()) categoryId: string) {
    return this.boutiqueService.setCategoryActive(categoryId, true);
  }

  @Post('categories/:categoryId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  public deactivateCategory(@Param('categoryId', new ParseUUIDPipe()) categoryId: string) {
    return this.boutiqueService.setCategoryActive(categoryId, false);
  }

  @Get('products')
  @RequirePermissions('menu:manage')
  public listProducts(@Query() query: ListBoutiqueDto) {
    return this.boutiqueService.listProducts(query);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('menu:manage')
  public createProduct(@Body() input: CreateBoutiqueProductDto) {
    return this.boutiqueService.createProduct(input);
  }

  @Get('products/:menuItemId')
  @RequirePermissions('menu:manage')
  public getProduct(@Param('menuItemId', new ParseUUIDPipe()) menuItemId: string) {
    return this.boutiqueService.getProduct(menuItemId);
  }

  @Patch('products/:menuItemId')
  @RequirePermissions('menu:manage')
  public updateProduct(
    @Param('menuItemId', new ParseUUIDPipe()) menuItemId: string,
    @Body() input: UpdateBoutiqueProductDto,
  ) {
    return this.boutiqueService.updateProduct(menuItemId, input);
  }

  @Post('products/:menuItemId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  public activateProduct(@Param('menuItemId', new ParseUUIDPipe()) menuItemId: string) {
    return this.boutiqueService.setProductActive(menuItemId, true);
  }

  @Post('products/:menuItemId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  public deactivateProduct(@Param('menuItemId', new ParseUUIDPipe()) menuItemId: string) {
    return this.boutiqueService.setProductActive(menuItemId, false);
  }

  @Post('products/:menuItemId/variants')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('menu:manage')
  public createVariant(
    @Param('menuItemId', new ParseUUIDPipe()) menuItemId: string,
    @Body() input: CreateBoutiqueVariantDto,
  ) {
    return this.boutiqueService.createVariant(menuItemId, input);
  }

  @Patch('variants/:variantId')
  @RequirePermissions('menu:manage')
  public updateVariant(
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() input: UpdateBoutiqueVariantDto,
  ) {
    return this.boutiqueService.updateVariant(variantId, input);
  }

  @Post('variants/:variantId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  public activateVariant(@Param('variantId', new ParseUUIDPipe()) variantId: string) {
    return this.boutiqueService.setVariantActive(variantId, true);
  }

  @Post('variants/:variantId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  public deactivateVariant(@Param('variantId', new ParseUUIDPipe()) variantId: string) {
    return this.boutiqueService.setVariantActive(variantId, false);
  }

  @Post('variants/:variantId/stock-adjustments')
  @RequirePermissions('inventory:manage')
  public adjustStock(
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @CurrentStaff() staff: PublicStaffUser,
    @Body() input: StockAdjustmentDto,
  ) {
    return this.boutiqueService.adjustStock(variantId, staff.id, input);
  }

  @Get('variants/:variantId/stock-movements')
  @RequirePermissions('inventory:manage')
  public stockMovements(@Param('variantId', new ParseUUIDPipe()) variantId: string) {
    return this.boutiqueService.listStockMovements(variantId);
  }
}
