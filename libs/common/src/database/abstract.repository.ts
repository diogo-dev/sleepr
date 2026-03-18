// Common repository where all other repositories in our microservices will extend from it
// It contains common CRUD functionality that all repositories will have
// This will make sure we will not duplicate this code in other microservices repositories

import { Model, QueryFilter, Types, UpdateQuery } from "mongoose";
import { AbstractDocument } from "./abstract.schema";
import { Logger, NotFoundException } from "@nestjs/common";

export abstract class AbstractRepository<TDocument extends AbstractDocument> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly model: Model<TDocument>) {}  

  async create(document: Omit<TDocument, "_id">): Promise<TDocument> {
    const createdDocument = new this.model({
      ...document,
      _id: new Types.ObjectId(),
    });
    return (await createdDocument.save()).toJSON() as unknown as TDocument;
  }

  async findOne(queryFilter: QueryFilter<TDocument>): Promise<TDocument> {
    const document = await this.model.findOne(queryFilter).lean<TDocument>(true);
    if (!document) {
      this.logger.warn('Document not found with queryFilter: ', queryFilter);
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async findOneAndUpdate(
    queryFilter: QueryFilter<TDocument>,
    update: UpdateQuery<TDocument>,
  ) : Promise<TDocument> {
    const document = await this.model.findOneAndUpdate(queryFilter, update, { new: true }).lean<TDocument>(true);

    if (!document) {
      this.logger.warn('Document not found with queryFilter: ', queryFilter);
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async find(queryFilter: QueryFilter<TDocument>): Promise<TDocument[]> {
    return this.model.find(queryFilter).lean<TDocument[]>(true);
  }

  async findOneAndDelete(queryFilter: QueryFilter<TDocument>): Promise<TDocument> {
    const document = await this.model.findOneAndDelete(queryFilter).lean<TDocument>(true);

    if (!document) {
      this.logger.warn('Document not found with queryFilter: ', queryFilter);
      throw new NotFoundException('Document not found');
    }

    return document;  
  }
}