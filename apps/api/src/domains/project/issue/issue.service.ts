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
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import {
  FindManyOptions,
  FindOptionsWhere,
  In,
  Like,
  Not,
  Raw,
  Repository,
} from 'typeorm';
import { Transactional } from 'typeorm-transactional';

import { TimeRange } from '@/common/dtos';
import { CountByProjectIdDto } from '@/domains/feedback/dtos';

import {
  CreateIssueDto,
  FindByIssueIdDto,
  FindIssuesByProjectIdDto,
  UpdateIssueDto,
} from './dtos';
import {
  IssueInvalidNameException,
  IssueNameDuplicatedException,
  IssueNotFoundException,
} from './exceptions';
import { IssueEntity } from './issue.entity';

@Injectable()
export class IssueService {
  constructor(
    @InjectRepository(IssueEntity)
    private readonly repository: Repository<IssueEntity>,
  ) {}

  @Transactional()
  async create(dto: CreateIssueDto) {
    const issue = CreateIssueDto.toIssueEntity(dto);

    const duplicateIssue = await this.repository.findOneBy({
      name: issue.name,
      project: { id: issue.project.id },
    });

    if (duplicateIssue) throw new IssueNameDuplicatedException();

    return await this.repository.save(issue);
  }

  async findIssuesByProjectId(dto: FindIssuesByProjectIdDto) {
    const { projectId, query = {}, sort = {}, page, limit } = dto;

    const searchOptions: FindManyOptions<IssueEntity> = {
      order: sort,
    };

    const andWhere: FindOptionsWhere<IssueEntity> = {
      project: { id: projectId },
    };

    if (query.createdAt) {
      andWhere.createdAt = Raw(
        (alias) => `${alias} >= :gte AND ${alias} < :lt`,
        query.createdAt as TimeRange,
      );
    }

    if (query.updatedAt) {
      andWhere.updatedAt = Raw(
        (alias) => `${alias} >= :gte AND ${alias} < :lt`,
        query.updatedAt as TimeRange,
      );
    }

    if (query.id) {
      andWhere.id = query.id as number;
    }

    for (const column of Object.keys(query)) {
      if (['id', 'createdAt', 'updatedAt', 'searchText'].includes(column)) {
        continue;
      }

      andWhere[column] = Like(`%${query[column]}%`);
    }

    if (query.searchText) {
      searchOptions.where = [
        { ...andWhere, name: Like(`%${query.searchText}%`) },
        { ...andWhere, description: Like(`%${query.searchText}%`) },
        { ...andWhere, externalIssueId: Like(`%${query.searchText}%`) },
      ];
      if (!Number.isNaN(parseInt(query.searchText))) {
        searchOptions.where.push({
          ...andWhere,
          id: parseInt(query.searchText),
        });
      }
    } else {
      searchOptions.where = [andWhere];
    }

    const result = await paginate(
      this.repository.createQueryBuilder().setFindOptions(searchOptions),
      { page, limit },
    );

    return result;
  }

  async findById({ issueId }: FindByIssueIdDto) {
    const issue = await this.repository.findOneBy({ id: issueId });
    if (!issue) throw new IssueNotFoundException();
    return issue;
  }

  async findIssuesByFeedbackIds(feedbackIds: number[]) {
    const issues = await this.repository.find({
      relations: { feedbacks: true },
      where: { feedbacks: { id: In(feedbackIds) } },
      order: { id: 'ASC' },
    });

    return feedbackIds.reduce(
      (issuesByFeedbackId: Record<number, IssueEntity[]>, feedbackId) => {
        issuesByFeedbackId[feedbackId] = issues
          .filter((issue) => {
            for (const feedbackIssue of issue.feedbacks) {
              if (feedbackIssue.id === feedbackId) {
                return true;
              }
            }
          })
          .map((issue) => {
            const { feedbacks: _, ...rest } = issue;
            return { ...rest } as IssueEntity;
          });

        return issuesByFeedbackId;
      },
      {},
    );
  }

  @Transactional()
  async update({
    issueId,
    name,
    description,
    status,
    externalIssueId,
  }: UpdateIssueDto) {
    await this.findById({ issueId });

    if (
      await this.repository.findOne({
        where: { name, id: Not(issueId) },
        select: ['id'],
      })
    ) {
      throw new IssueInvalidNameException('Duplicated name');
    }
    await this.repository.update(
      { id: issueId },
      { id: issueId, name, description, status, externalIssueId },
    );
  }

  @Transactional()
  async deleteById(id: number) {
    const issue = new IssueEntity();
    issue.id = id;
    await this.repository.remove(issue);
  }

  @Transactional()
  async deleteByIds(ids: number[]) {
    const issues = ids.map((id) => {
      const issue = new IssueEntity();
      issue.id = id;
      return issue;
    });
    await this.repository.remove(issues);
  }

  async countByProjectId({ projectId }: CountByProjectIdDto) {
    return {
      total: await this.repository.count({
        relations: { project: true },
        where: { project: { id: projectId } },
      }),
    };
  }
}
