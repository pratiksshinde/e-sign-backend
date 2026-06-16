import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Document } from './document.model';
import { AuditLog } from './audit-log.model';
import { DocumentStatus, WorkflowStep } from '../../common/enums';

@Table({
  tableName: 'workflows',
  timestamps: true,
})
export class Workflow extends Model {
  @ForeignKey(() => Document)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare documentId: number;

  @BelongsTo(() => Document)
  document: Document;

  @Column({ type: DataType.STRING, allowNull: false })
  declare role1Email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare role2Email: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare role3Email: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare docusealSubmissionId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare docusealRole2SubmitterId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare docusealRole3SubmitterId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare signedDocumentPath: string;

  @Column({
    type: DataType.ENUM(...Object.values(DocumentStatus)),
    defaultValue: DocumentStatus.DRAFT,
  })
  declare status: DocumentStatus;

  @Column({
    type: DataType.ENUM(...Object.values(WorkflowStep)),
    defaultValue: WorkflowStep.ROLE_1,
  })
  declare currentStep: WorkflowStep;

  @HasMany(() => AuditLog)
  auditLogs: AuditLog[];
}