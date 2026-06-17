import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'webhook_logs',
  timestamps: true,
})
export class WebhookLog extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  declare eventType: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare rawPayload: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare submissionId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare role: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare processingStatus: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare errorMessage: string;
}
