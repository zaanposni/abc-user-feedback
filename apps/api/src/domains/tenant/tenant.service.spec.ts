/**
 * Copyright 2023 LINE Corporation
 *
 * LINE Corporation licenses this file to you under the Apache License,
 * version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { mockRepository } from '@/utils/test-utils';

import { FeedbackEntity } from '../feedback/feedback.entity';
import { UserEntity } from '../user/entities/user.entity';
import {
  FeedbackCountByTenantIdDto,
  SetupTenantDto,
  UpdateTenantDto,
} from './dtos';
import {
  TenantAlreadyExistsException,
  TenantNotFoundException,
} from './exceptions';
import { TenantEntity } from './tenant.entity';
import { TenantService } from './tenant.service';

export const TenantServiceProviders = [
  TenantService,
  {
    provide: getRepositoryToken(TenantEntity),
    useValue: mockRepository(),
  },
  {
    provide: getRepositoryToken(UserEntity),
    useValue: mockRepository(),
  },
  {
    provide: getRepositoryToken(FeedbackEntity),
    useValue: mockRepository(),
  },
];

describe('TenantService', () => {
  let tenantService: TenantService;
  let tenantRepo: Repository<TenantEntity>;
  let userRepo: Repository<UserEntity>;
  let feedbackRepo: Repository<FeedbackEntity>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: TenantServiceProviders,
    }).compile();
    tenantService = module.get(TenantService);
    tenantRepo = module.get(getRepositoryToken(TenantEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    feedbackRepo = module.get(getRepositoryToken(FeedbackEntity));
  });

  describe('create', () => {
    it('creation succeeds with valid data', async () => {
      const dto = new SetupTenantDto();
      dto.siteName = faker.datatype.string();
      jest.spyOn(tenantRepo, 'find').mockResolvedValue([]);

      await tenantService.create(dto);

      expect(tenantRepo.find).toHaveBeenCalledTimes(1);
      expect(tenantRepo.save).toHaveBeenCalledTimes(1);
      expect(tenantRepo.save).toHaveBeenCalledWith(dto);
      expect(userRepo.save).toHaveBeenCalledTimes(1);
    });
    it('creation fails with the duplicate site name', async () => {
      const dto = new SetupTenantDto();
      dto.siteName = faker.datatype.string();
      jest.spyOn(tenantRepo, 'find').mockResolvedValue([{} as TenantEntity]);

      await expect(tenantService.create(dto)).rejects.toThrow(
        TenantAlreadyExistsException,
      );
    });
  });
  describe('update', () => {
    const dto = new UpdateTenantDto();
    dto.siteName = faker.datatype.string();
    dto.useEmail = faker.datatype.boolean();
    dto.isPrivate = faker.datatype.boolean();
    dto.isRestrictDomain = faker.datatype.boolean();
    dto.allowDomains = [faker.datatype.string()];
    dto.useOAuth = faker.datatype.boolean();
    dto.oauthConfig = {
      clientId: faker.datatype.string(),
      clientSecret: faker.datatype.string(),
      authCodeRequestURL: faker.datatype.string(),
      scopeString: faker.datatype.string(),
      accessTokenRequestURL: faker.datatype.string(),
      userProfileRequestURL: faker.datatype.string(),
      emailKey: faker.datatype.string(),
      defatulLoginEnable: faker.datatype.boolean(),
    };

    it('update succeeds with valid data', async () => {
      const tenantId = faker.datatype.number();
      jest
        .spyOn(tenantRepo, 'find')
        .mockResolvedValue([{ id: tenantId }] as TenantEntity[]);

      await tenantService.update(dto);

      expect(tenantRepo.find).toHaveBeenCalledTimes(1);
      expect(tenantRepo.update).toHaveBeenCalledTimes(1);
      expect(tenantRepo.update).toHaveBeenCalledWith(
        { id: tenantId },
        { ...dto, id: tenantId },
      );
    });
    it('update fails when there is no tenant', async () => {
      jest.spyOn(tenantRepo, 'find').mockResolvedValue([] as TenantEntity[]);

      await expect(tenantService.update(dto)).rejects.toThrow(
        TenantNotFoundException,
      );
    });
  });
  describe('findOne', () => {
    it('finding a tenant succeeds when there is a tenant', async () => {
      const tenantId = faker.datatype.number();
      jest
        .spyOn(tenantRepo, 'find')
        .mockResolvedValue([{ id: tenantId }] as TenantEntity[]);

      const tenant = await tenantService.findOne();

      expect(tenantRepo.find).toHaveBeenCalledTimes(1);
      expect(tenant).toEqual({ id: tenantId });
    });
    it('finding a tenant fails when there is a tenant', async () => {
      jest.spyOn(tenantRepo, 'find').mockResolvedValue([] as TenantEntity[]);

      await expect(tenantService.findOne()).rejects.toThrow(
        TenantNotFoundException,
      );
    });
  });
  describe('countByTenantId', () => {
    it('counting feedbacks by tenant id', async () => {
      const count = faker.datatype.number();
      const tenantId = faker.datatype.number();
      const dto = new FeedbackCountByTenantIdDto();
      dto.tenantId = tenantId;
      jest.spyOn(feedbackRepo, 'count').mockResolvedValue(count);

      const feedbackCounts = await tenantService.countByTenantId(dto);

      expect(feedbackRepo.count).toHaveBeenCalledTimes(1);
      expect(feedbackRepo.count).toHaveBeenCalledWith({
        where: {
          channel: {
            project: {
              tenant: {
                id: dto.tenantId,
              },
            },
          },
        },
      });
      expect(feedbackCounts.total).toEqual(count);
    });
  });
});
