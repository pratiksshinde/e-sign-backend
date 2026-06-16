import {
  Table,
  Column,
  Model,
  DataType,
  HasOne,
  HasMany,
} from 'sequelize-typescript';
import { DocumentStatus } from '../../common/enums';
import { Workflow } from './workflow.model';
import { SignatureTag } from './signature-tag.model';
import { AuditLog } from './audit-log.model';

@Table({
  tableName: 'documents',
  timestamps: true,
})
export class Document extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  declare fileName: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare filePath: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare uploadedByEmail: string;

  @Column({
    type: DataType.ENUM(...Object.values(DocumentStatus)),
    defaultValue: DocumentStatus.DRAFT,
  })
  declare status: DocumentStatus;

  @Column({ type: DataType.STRING, allowNull: true })
  declare currentSigner: string;

  @HasOne(() => Workflow)
  workflow: Workflow;

  @HasMany(() => SignatureTag)
  signatureTags: SignatureTag[];

  @HasMany(() => AuditLog)
  auditLogs: AuditLog[];
}