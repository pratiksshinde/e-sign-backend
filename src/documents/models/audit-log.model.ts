import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Document } from './document.model';
import { Workflow } from './workflow.model';
import { AuditAction, SignerRole } from '../../common/enums';

@Table({
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
})
export class AuditLog extends Model {
  @ForeignKey(() => Workflow)
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare workflowId: number;

  @BelongsTo(() => Workflow)
  workflow: Workflow;

  @ForeignKey(() => Document)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare documentId: number;

  @BelongsTo(() => Document)
  document: Document;

  @Column({
    type: DataType.ENUM(...Object.values(AuditAction)),
    allowNull: false,
  })
  declare action: AuditAction;

  @Column({
    type: DataType.ENUM(...Object.values(SignerRole)),
    allowNull: true,
  })
  declare performedByRole: SignerRole;

  @Column({ type: DataType.STRING, allowNull: true })
  declare performedByEmail: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare message: string;
}