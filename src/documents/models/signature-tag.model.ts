import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Document } from './document.model';
import { SignerRole, FieldType } from '../../common/enums';

@Table({
  tableName: 'signature_tags',
  timestamps: true,
})
export class SignatureTag extends Model {
  @ForeignKey(() => Document)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare documentId: number;

  @BelongsTo(() => Document)
  document: Document;

  @Column({
    type: DataType.ENUM(SignerRole.ROLE_2, SignerRole.ROLE_3),
    allowNull: false,
  })
  declare role: SignerRole;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare pageNumber: number;

  @Column({ type: DataType.FLOAT, allowNull: false })
  declare xPosition: number;

  @Column({ type: DataType.FLOAT, allowNull: false })
  declare yPosition: number;

  @Column({ type: DataType.FLOAT, allowNull: false })
  declare width: number;

  @Column({ type: DataType.FLOAT, allowNull: false })
  declare height: number;

  @Column({
    type: DataType.ENUM(...Object.values(FieldType)),
    allowNull: false,
  })
  declare fieldType: FieldType;
}