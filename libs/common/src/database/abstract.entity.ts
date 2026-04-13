// Common schema where all other entities in our microservices will extend from it
// It contain fields that are common to all database entities

import { Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AbstractEntity<T> {
  @PrimaryGeneratedColumn() 
  id: number;

  constructor(entity: Partial<T>) {
    Object.assign(this, entity);
  }
}