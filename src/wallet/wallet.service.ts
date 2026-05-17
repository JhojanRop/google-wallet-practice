import { CreatePassDto } from './dto/create-pass.dto';
import { GoogleAuth, JWT } from 'google-auth-library';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import { UpdatePassDto } from './dto/update-pass.dto';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private readonly apiBaseUrl = 'https://walletobjects.googleapis.com/walletobjects/v1';

  private readonly issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  private readonly classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX;
  private readonly serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  private readonly classId = `${this.issuerId}.${this.classSuffix}`;
  private credentials!: ServiceAccountCredentials;
  private httpClient!: JWT;

  async onModuleInit() {
    this.logger.log('WalletService has been initialized');
    try {
      if (!this.serviceAccountPath) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not defined');
      }

      const credentialsContent = fs.readFileSync(this.serviceAccountPath, 'utf-8');

      this.credentials = JSON.parse(credentialsContent) as ServiceAccountCredentials;
      this.logger.log('Service account credentials loaded successfully');

      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
      });

      this.httpClient = (await auth.getClient()) as JWT;
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }

  private async request(method: string, endpoint: string, body?: Record<string, any>) {
    const response = await this.httpClient.request({
      method,
      url: `${this.apiBaseUrl}${endpoint}`,
      data: body,
    });
    return response.data;
  }

  async createClass() {
    try {
      const classData = await this.request('GET', `/genericClass/${this.classId}`);
      this.logger.log(`Class ${this.classId} already exists`);
      return classData;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        return await this.request('POST', '/genericClass', {
          id: this.classId,
          issuerName: 'NullPointerException',
          reviewStatus: 'UNDER_REVIEW',
        });
      }

      this.logger.error(error);
      throw error;
    }
  }

  async createPassObject(passData: CreatePassDto) {
    const objectId = `${this.issuerId}.user_${passData.userId}`;
    try {
      const objectData = await this.request('GET', `/genericObject/${objectId}`);
      this.logger.log(`Object ${objectId} already exists`);
      return objectData;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        const modulesData = [
          {
            id: 'event',
            header: 'Event',
            body: passData.eventName,
          },
          {
            id: 'date',
            header: 'Date',
            body: passData.eventDate,
          },
          {
            id: 'holder',
            header: 'Titular',
            body: passData.holderName,
          },
        ];

        if (passData.seat) {
          modulesData.push({
            id: 'seat',
            header: 'Seat',
            body: passData.seat,
          });
        }

        return await this.request('POST', '/genericObject', {
          id: objectId,
          classId: this.classId,
          state: 'ACTIVE',
          barcode: {
            type: 'QR_CODE',
            value: objectId,
          },
          cardTitle: {
            defaultValue: {
              language: 'es',
              value: 'DevFest Medellín 2026',
            },
          },
          header: {
            defaultValue: {
              language: 'es',
              value: passData.holderName,
            },
          },
          textModulesData: modulesData,
        });
      }

      this.logger.error(error);
      throw error;
    }
  }

  generateAddToWalletLink(userId: string) {
    const objectId = `${this.issuerId}.user_${userId}`;

    const claims = {
      iss: this.credentials.client_email,
      aud: 'google',
      origins: ['http://localhost:3000'],
      typ: 'savetowallet',
      payload: {
        genericObjects: [{ id: objectId }],
      },
    };

    const token = jwt.sign(claims, this.credentials.private_key, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  async updatePassObject(passData: UpdatePassDto) {
    const objectId = `${this.issuerId}.user_${passData.userId}`;
    try {
      const passObject = (await this.request('GET', `/genericObject/${objectId}`)) as {
        state: string;
        textModulesData: { id: string; header: string; body: string }[];
      };

      this.logger.log(passData);

      const updatedObject = {
        state: passData.state || passObject.state,
        textModulesData: passObject.textModulesData.map((module) => {
          if (module.id === 'event' && passData.eventName) {
            return { ...module, body: passData.eventName };
          }
          if (module.id === 'date' && passData.eventDate) {
            return { ...module, body: passData.eventDate };
          }
          if (module.id === 'holder' && passData.holderName) {
            return { ...module, body: passData.holderName };
          }
          if (module.id === 'seat' && passData.seat) {
            return { ...module, body: passData.seat };
          }
          return module;
        }),
      };

      return await this.request('PATCH', `/genericObject/${objectId}`, updatedObject);
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }

  async expirePassObject(userId: string) {
    return this.updatePassObject({ userId, state: 'EXPIRED' });
  }
}
