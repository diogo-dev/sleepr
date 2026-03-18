// Common schema where all other schemas in our microservices will extend from it
// It contain fields that are common to all database documents

import { Prop, Schema } from "@nestjs/mongoose";
import { SchemaTypes, Types } from "mongoose";

@Schema()
export class AbstractDocument {
  @Prop({ type: SchemaTypes.ObjectId})
  _id: Types.ObjectId;
}