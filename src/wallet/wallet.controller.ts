import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreatePassDto } from './dto/create-pass.dto';
import { UpdatePassDto } from './dto/update-pass.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('class')
  async createClass() {
    return await this.walletService.createClass();
  }

  @Post('pass')
  async createPass(@Body() passData: CreatePassDto) {
    return await this.walletService.createPassObject(passData);
  }

  @Get('pass/:userId/link')
  generateAddToWalletLink(@Param('userId') userId: string) {
    return this.walletService.generateAddToWalletLink(userId);
  }

  @Patch('pass')
  async updatePass(@Body() passData: UpdatePassDto) {
    return await this.walletService.updatePassObject(passData);
  }

  @Patch('pass/:userId/expire')
  async expirePass(@Param('userId') userId: string) {
    return await this.walletService.expirePassObject(userId);
  }
}
